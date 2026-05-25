import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { db, now } from "./db";
import { sendEmail } from "./email";
import { fmtDateTime } from "./format";

interface DueReminder {
  id: string;
  event_id: string;
  reminder_type: "one_month" | "one_week";
  scheduled_for: number;
  title: string;
  slug: string;
  start_at: number;
  location_name: string | null;
  registration_url: string | null;
}

interface Subscriber {
  email: string;
  name: string | null;
  unsubscribe_token: string;
}

/**
 * Finds reminders that are due (scheduled_for <= now and not yet sent),
 * sends each to every active newsletter subscriber, and marks them sent.
 *
 * Returns a summary that can be shown back to the admin who triggered this.
 */
export async function processDueReminders(ctx: APIContext): Promise<{
  remindersProcessed: number;
  emailsSent: number;
  mode: "live" | "offline";
}> {
  const ts = now();

  const { results: due } = await db(ctx)
    .prepare(
      `SELECT r.id, r.event_id, r.reminder_type, r.scheduled_for,
              e.title, e.slug, e.start_at, e.location_name, e.registration_url
       FROM event_reminders r
       JOIN events e ON e.id = r.event_id
       WHERE r.sent_at IS NULL
         AND r.scheduled_for <= ?
         AND e.status IN ('scheduled', 'postponed')
       ORDER BY r.scheduled_for ASC`,
    )
    .bind(ts)
    .all<DueReminder>();

  const { results: subscribers } = await db(ctx)
    .prepare(
      `SELECT email, name, unsubscribe_token
       FROM newsletter_subscribers
       WHERE unsubscribed_at IS NULL`,
    )
    .all<Subscriber>();

  const mode: "live" | "offline" = env.RESEND_API_KEY ? "live" : "offline";
  const siteUrl = env.PUBLIC_SITE_URL ?? "http://localhost:4321";

  let emailsSent = 0;

  for (const r of due) {
    const subject = r.reminder_type === "one_month"
      ? `[Save the date] ${r.title} — ${fmtDateTime(r.start_at)}`
      : `[Reminder] ${r.title} this week`;

    for (const sub of subscribers) {
      const html = renderReminderHtml({
        title: r.title,
        slug: r.slug,
        startAt: r.start_at,
        locationName: r.location_name,
        registrationUrl: r.registration_url,
        reminderType: r.reminder_type,
        subscriberName: sub.name,
        siteUrl,
        unsubscribeToken: sub.unsubscribe_token,
      });

      await sendEmail(ctx, {
        to: sub.email,
        subject,
        template: `event_reminder_${r.reminder_type}`,
        html,
        related_id: r.event_id,
      });
      emailsSent++;
    }

    await db(ctx)
      .prepare(`UPDATE event_reminders SET sent_at = ?, recipient_count = ? WHERE id = ?`)
      .bind(now(), subscribers.length, r.id)
      .run();
  }

  return { remindersProcessed: due.length, emailsSent, mode };
}

function renderReminderHtml(args: {
  title: string;
  slug: string;
  startAt: number;
  locationName: string | null;
  registrationUrl: string | null;
  reminderType: "one_month" | "one_week";
  subscriberName: string | null;
  siteUrl: string;
  unsubscribeToken: string;
}): string {
  const headline = args.reminderType === "one_month"
    ? `${args.title} is coming up in about a month`
    : `${args.title} is this week`;
  const greeting = args.subscriberName ? `Hi ${args.subscriberName},` : "Hi,";
  const eventUrl = `${args.siteUrl}/events/${args.slug}`;
  const unsubUrl = `${args.siteUrl}/api/newsletter/unsubscribe?token=${args.unsubscribeToken}`;

  return `<!doctype html><html><body style="font-family:system-ui;color:#0f1f3d;max-width:600px;margin:auto;padding:1.5rem">
    <p>${greeting}</p>
    <h1 style="font-size:1.5rem;margin:1rem 0">${headline}</h1>
    <p><strong>When:</strong> ${fmtDateTime(args.startAt)}</p>
    ${args.locationName ? `<p><strong>Where:</strong> ${args.locationName}</p>` : ""}
    <p style="margin:1.5rem 0">
      <a href="${eventUrl}" style="background:#1d3a6b;color:white;padding:0.6rem 1rem;border-radius:6px;text-decoration:none">
        Event details →
      </a>
      ${args.registrationUrl ? `
        <a href="${args.registrationUrl}" style="margin-left:0.5rem;color:#1d3a6b">
          Register on MotorsportReg →
        </a>` : ""}
    </p>
    <hr style="margin-top:2rem;border:0;border-top:1px solid #e2e8f0">
    <p style="font-size:0.75rem;color:#94a3b8;margin-top:1rem">
      You're getting this because you subscribed to CSCC event reminders.
      <a href="${unsubUrl}" style="color:#94a3b8">Unsubscribe</a>.
    </p>
  </body></html>`;
}
