import type { APIRoute } from "astro";
import { db, now } from "~/lib/db";
import { required, seeOther } from "~/lib/forms";

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const form = await ctx.request.formData();
  const id = required(form, "id");
  const ts = now();

  await db(ctx).prepare(`UPDATE seasons SET is_current = 0, updated_at = ? WHERE is_current = 1`).bind(ts).run();
  await db(ctx).prepare(`UPDATE seasons SET is_current = 1, updated_at = ? WHERE id = ?`).bind(ts, id).run();

  return seeOther("/admin/seasons", "Current season updated.");
};
