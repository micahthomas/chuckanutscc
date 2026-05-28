import type { APIRoute } from "astro";
import { db, now } from "~/lib/db";
import { required, seeOther } from "~/lib/forms";
import { generateUploadToken } from "~/lib/tokens";

/**
 * Rotates a photographer's secret upload token. The old `/p/<oldToken>` URL
 * stops working immediately — there's no grace period — so this is the
 * recovery path when a URL leaks. Admins should communicate the new URL out-
 * of-band before regenerating.
 */
export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const form = await ctx.request.formData();
  const id = required(form, "id");

  await db(ctx)
    .prepare(`UPDATE photographers SET upload_token = ?, updated_at = ? WHERE id = ?`)
    .bind(generateUploadToken(), now(), id)
    .run();

  return seeOther(`/admin/photographers/${id}`, "Upload URL regenerated. Old URL no longer works.");
};
