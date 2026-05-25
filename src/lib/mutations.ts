import type { APIContext } from "astro";
import { db, now } from "./db";
import { newId } from "./id";

const SECONDS_PER_DAY = 86_400;
const ONE_WEEK = 7 * SECONDS_PER_DAY;
const ONE_MONTH = 30 * SECONDS_PER_DAY;

/**
 * Inserts or updates the one_month / one_week reminder rows for an event.
 * If the scheduled time is in the past, marks the reminder as already sent
 * with recipient_count = 0 (so cron skips it).
 */
export async function upsertEventReminders(
  ctx: APIContext,
  eventId: string,
  startAt: number,
): Promise<void> {
  const ts = now();
  const reminders: Array<{ type: "one_month" | "one_week"; scheduledFor: number }> = [
    { type: "one_month", scheduledFor: startAt - ONE_MONTH },
    { type: "one_week",  scheduledFor: startAt - ONE_WEEK },
  ];

  for (const r of reminders) {
    const existing = await db(ctx)
      .prepare(
        `SELECT id, sent_at FROM event_reminders
         WHERE event_id = ? AND reminder_type = ?`,
      )
      .bind(eventId, r.type)
      .first<{ id: string; sent_at: number | null }>();

    const alreadyDue = r.scheduledFor < ts;

    if (!existing) {
      await db(ctx)
        .prepare(
          `INSERT INTO event_reminders (id, event_id, reminder_type, scheduled_for, sent_at, recipient_count)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newId(),
          eventId,
          r.type,
          r.scheduledFor,
          alreadyDue ? ts : null,
          alreadyDue ? 0 : null,
        )
        .run();
    } else if (existing.sent_at === null) {
      // Reschedule unsent reminder (event date moved).
      await db(ctx)
        .prepare(
          `UPDATE event_reminders SET scheduled_for = ? WHERE id = ?`,
        )
        .bind(r.scheduledFor, existing.id)
        .run();
    }
  }
}

/**
 * Cancels future reminders for an event (e.g. when status flips to 'cancelled').
 */
export async function cancelEventReminders(ctx: APIContext, eventId: string): Promise<void> {
  await db(ctx)
    .prepare(
      `UPDATE event_reminders SET sent_at = ?, recipient_count = 0
       WHERE event_id = ? AND sent_at IS NULL`,
    )
    .bind(now(), eventId)
    .run();
}

/**
 * Records a successful membership payment and updates the member's expires_at.
 * Used by both the Stripe webhook and the offline mock checkout return.
 */
export interface MembershipApplicant {
  memberEmail: string;
  memberName: string;
  tierId: string;
  amountCents: number;
  membershipYear: number;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId?: string | null;
  rawStripeEventJson?: string | null;
  /** Captured during the public signup; all optional so legacy callers still work. */
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  carInfo?: string | null;
  familyMemberName?: string | null;
}

export async function recordMembershipPayment(
  ctx: APIContext,
  args: MembershipApplicant,
): Promise<{ memberId: string; isNew: boolean }> {
  const ts = now();

  let member = await db(ctx)
    .prepare(`SELECT id FROM members WHERE email = ?`)
    .bind(args.memberEmail)
    .first<{ id: string }>();

  let memberId: string;
  let isNew = false;

  if (member) {
    memberId = member.id;
  } else {
    memberId = newId();
    isNew = true;
    await db(ctx)
      .prepare(
        `INSERT INTO members (id, name, email, tier_id, joined_at, newsletter_opt_in, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(memberId, args.memberName, args.memberEmail, args.tierId, ts, ts, ts)
      .run();
  }

  // Membership year ends Dec 31, 23:59:59 Pacific (which is roughly Jan 1, 07:59:59 UTC).
  // For simplicity we use Dec 31 23:59:59 UTC; off by ~8h doesn't matter for the calendar.
  const yearEnd = Math.floor(Date.UTC(args.membershipYear, 11, 31, 23, 59, 59) / 1000);

  // Update the member row. COALESCE keeps existing values when the applicant
  // left a field blank (e.g. renewals where the address didn't change).
  await db(ctx)
    .prepare(
      `UPDATE members SET
         tier_id     = ?,
         expires_at  = MAX(COALESCE(expires_at, 0), ?),
         name        = COALESCE(NULLIF(?, ''), name),
         phone       = COALESCE(NULLIF(?, ''), phone),
         address_line1 = COALESCE(NULLIF(?, ''), address_line1),
         address_line2 = COALESCE(NULLIF(?, ''), address_line2),
         city        = COALESCE(NULLIF(?, ''), city),
         state       = COALESCE(NULLIF(?, ''), state),
         postal_code = COALESCE(NULLIF(?, ''), postal_code),
         car_info    = COALESCE(NULLIF(?, ''), car_info),
         family_member_name = NULLIF(?, ''),
         updated_at  = ?
       WHERE id = ?`,
    )
    .bind(
      args.tierId, yearEnd,
      args.memberName ?? "",
      args.phone ?? "",
      args.addressLine1 ?? "",
      args.addressLine2 ?? "",
      args.city ?? "",
      args.state ?? "",
      args.postalCode ?? "",
      args.carInfo ?? "",
      args.familyMemberName ?? "",
      ts, memberId,
    )
    .run();

  await db(ctx)
    .prepare(
      `INSERT INTO member_payments (id, member_id, tier_id, amount_cents, membership_year,
                                    stripe_checkout_session_id, stripe_payment_intent_id,
                                    paid_at, raw_stripe_event_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (stripe_checkout_session_id) DO NOTHING`,
    )
    .bind(
      newId(),
      memberId,
      args.tierId,
      args.amountCents,
      args.membershipYear,
      args.stripeCheckoutSessionId,
      args.stripePaymentIntentId ?? null,
      ts,
      args.rawStripeEventJson ?? null,
    )
    .run();

  return { memberId, isNew };
}

/**
 * Adds a newsletter subscriber if not already present (or reactivates if previously unsubscribed).
 */
export async function subscribeNewsletter(
  ctx: APIContext,
  email: string,
  name: string | null,
  source: string,
): Promise<{ id: string; alreadySubscribed: boolean }> {
  const existing = await db(ctx)
    .prepare(`SELECT id, unsubscribed_at FROM newsletter_subscribers WHERE email = ?`)
    .bind(email)
    .first<{ id: string; unsubscribed_at: number | null }>();

  if (existing) {
    if (existing.unsubscribed_at !== null) {
      await db(ctx)
        .prepare(`UPDATE newsletter_subscribers SET unsubscribed_at = NULL WHERE id = ?`)
        .bind(existing.id)
        .run();
      return { id: existing.id, alreadySubscribed: false };
    }
    return { id: existing.id, alreadySubscribed: true };
  }

  const id = newId();
  await db(ctx)
    .prepare(
      `INSERT INTO newsletter_subscribers (id, email, name, source, subscribed_at, unsubscribe_token)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, email, name, source, now(), newId())
    .run();
  return { id, alreadySubscribed: false };
}
