import type { APIRoute } from "astro";
import { db } from "~/lib/db";
import { required, seeOther } from "~/lib/forms";

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const form = await ctx.request.formData();
  const id = required(form, "id");
  // FK ON DELETE SET NULL takes care of detaching events.
  await db(ctx).prepare(`DELETE FROM locations WHERE id = ?`).bind(id).run();
  return seeOther("/admin/locations", "Location deleted.");
};
