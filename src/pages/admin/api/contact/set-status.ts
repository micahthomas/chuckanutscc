import type { APIRoute } from "astro";
import { db } from "~/lib/db";
import { required, seeOther, badRequest } from "~/lib/forms";

const ALLOWED = new Set(["new", "responded", "archived"]);

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const form = await ctx.request.formData();
  const id = required(form, "id");
  const status = required(form, "status");
  if (!ALLOWED.has(status)) return badRequest("Invalid status");

  await db(ctx)
    .prepare(`UPDATE contact_submissions SET status = ? WHERE id = ?`)
    .bind(status, id)
    .run();

  return seeOther(`/admin/contact/${id}`, `Marked ${status}.`);
};
