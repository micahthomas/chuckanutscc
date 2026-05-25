import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { db, now } from "./db";
import { newId } from "./id";

export interface SendOptions {
  to: string;
  subject: string;
  template: string;            // descriptive label, e.g. "event_reminder_one_week"
  html: string;
  related_id?: string;
}

/**
 * Sends an email via Resend if RESEND_API_KEY is set, otherwise logs only.
 * Either way, an `email_log` row is written so the demo can show what would
 * have gone out.
 */
export async function sendEmail(ctx: APIContext, opts: SendOptions): Promise<{ id: string; mode: "live" | "offline" }> {
  const key = env.RESEND_API_KEY;
  const id = newId();
  let resendId: string | null = null;
  let status: "sent" | "failed" = "sent";
  let error: string | null = null;
  const mode: "live" | "offline" = key ? "live" : "offline";

  if (mode === "live") {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          from: `CSCC <no-reply@${new URL(env.PUBLIC_SITE_URL).hostname}>`,
          to: opts.to,
          subject: opts.subject,
          html: opts.html,
        }),
      });
      if (!res.ok) {
        status = "failed";
        error = `Resend ${res.status}: ${await res.text()}`;
      } else {
        const body = (await res.json()) as { id?: string };
        resendId = body.id ?? null;
      }
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : String(e);
    }
  }

  await db(ctx)
    .prepare(
      `INSERT INTO email_log (id, recipient_email, subject, template, related_id,
                              resend_id, status, sent_at, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      opts.to,
      opts.subject,
      opts.template,
      opts.related_id ?? null,
      resendId,
      status,
      now(),
      error,
    )
    .run();

  return { id, mode };
}
