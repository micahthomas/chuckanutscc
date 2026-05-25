import type { APIRoute } from "astro";
import { seeOther } from "~/lib/forms";
import { processDueReminders } from "~/lib/reminders";

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const result = await processDueReminders(ctx);
  const msg = result.remindersProcessed === 0
    ? "Nothing due right now."
    : `Processed ${result.remindersProcessed} reminder(s), ${result.emailsSent} email(s) ${result.mode === "live" ? "sent" : "logged (offline)"}.`;
  return seeOther("/admin/reminders", msg);
};
