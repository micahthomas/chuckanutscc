import type { APIRoute } from "astro";
import { db, now } from "~/lib/db";
import { newId } from "~/lib/id";
import { required, str, seeOther } from "~/lib/forms";

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();

  const name = required(form, "name");
  const email = required(form, "email");
  const message = required(form, "message");
  const subject = str(form.get("subject"));
  const topic = str(form.get("topic")) ?? "general";

  await db(ctx)
    .prepare(
      `INSERT INTO contact_submissions (id, name, email, subject, message, topic, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(newId(), name, email, subject, message, topic, now())
    .run();

  return seeOther("/contact", "Thanks — we'll get back to you soon.");
};
