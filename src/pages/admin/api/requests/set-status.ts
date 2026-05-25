import type { APIRoute } from "astro";
import { db, now } from "~/lib/db";
import { required, seeOther, badRequest } from "~/lib/forms";

const ALLOWED = new Set(["open", "in_next_order", "fulfilled", "cancelled"]);

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const form = await ctx.request.formData();
  const id = required(form, "id");
  const status = required(form, "status");
  if (!ALLOWED.has(status)) return badRequest("Invalid status");

  await db(ctx)
    .prepare(`UPDATE merch_requests SET status = ?, updated_at = ? WHERE id = ?`)
    .bind(status, now(), id)
    .run();

  const back = ctx.request.headers.get("referer") ?? "/admin/requests";
  return seeOther(back, `Request set to ${status.replace(/_/g, " ")}.`);
};
