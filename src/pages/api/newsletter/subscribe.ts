import type { APIRoute } from "astro";
import { required, str, seeOther } from "~/lib/forms";
import { subscribeNewsletter } from "~/lib/mutations";

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const email = required(form, "email");
  const name = str(form.get("name"));
  const source = str(form.get("source")) ?? "footer-form";

  const result = await subscribeNewsletter(ctx, email, name, source);
  const msg = result.alreadySubscribed
    ? "You're already subscribed — thanks!"
    : "Subscribed. Look out for event reminders.";

  return seeOther(ctx.request.headers.get("referer") ?? "/", msg);
};
