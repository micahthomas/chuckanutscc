import type { APIRoute } from "astro";
import { db } from "~/lib/db";
import { required, seeOther, badRequest } from "~/lib/forms";

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const form = await ctx.request.formData();
  const id = required(form, "id");

  // Block delete if they have photos (the FK is RESTRICT).
  const photoCount = await db(ctx)
    .prepare(`SELECT COUNT(*) AS n FROM photos WHERE photographer_id = ?`)
    .bind(id)
    .first<{ n: number }>();
  if (photoCount && photoCount.n > 0) {
    return badRequest(`Cannot delete: this photographer has ${photoCount.n} photo(s) on the site. Remove or reassign them first.`);
  }

  await db(ctx).prepare(`DELETE FROM event_photographers WHERE photographer_id = ?`).bind(id).run();
  await db(ctx).prepare(`DELETE FROM photographers WHERE id = ?`).bind(id).run();

  return seeOther("/admin/photographers", "Photographer deleted.");
};
