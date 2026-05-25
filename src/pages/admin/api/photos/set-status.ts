import type { APIRoute } from "astro";
import { db, now } from "~/lib/db";
import { required, seeOther, badRequest } from "~/lib/forms";

const ALLOWED = new Set(["live", "hidden", "rejected"]);

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const form = await ctx.request.formData();
  const id = required(form, "id");
  const status = required(form, "status");
  if (!ALLOWED.has(status)) return badRequest("Invalid status");

  await db(ctx)
    .prepare(
      `UPDATE photos SET status = ?, hidden_at = ?, hidden_by = ? WHERE id = ?`,
    )
    .bind(status, status === "live" ? null : now(), status === "live" ? null : ctx.locals.admin.email, id)
    .run();

  const back = ctx.request.headers.get("referer") ?? "/admin/photos";
  return seeOther(back, `Photo set to ${status}.`);
};
