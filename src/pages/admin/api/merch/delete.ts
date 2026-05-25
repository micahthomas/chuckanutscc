import type { APIRoute } from "astro";
import { db } from "~/lib/db";
import { required, seeOther, badRequest } from "~/lib/forms";

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const form = await ctx.request.formData();
  const id = required(form, "id");

  const refs = await db(ctx)
    .prepare(`SELECT COUNT(*) AS n FROM merch_requests WHERE item_id = ?`)
    .bind(id)
    .first<{ n: number }>();
  if (refs && refs.n > 0) {
    return badRequest(`Cannot delete: ${refs.n} request(s) reference this item. Cancel them first.`);
  }

  await db(ctx).prepare(`DELETE FROM merch_items WHERE id = ?`).bind(id).run();
  return seeOther("/admin/merch", "Item deleted.");
};
