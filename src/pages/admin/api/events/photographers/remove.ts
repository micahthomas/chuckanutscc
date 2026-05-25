import type { APIRoute } from "astro";
import { db } from "~/lib/db";
import { required, seeOther } from "~/lib/forms";

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const form = await ctx.request.formData();

  const eventId = required(form, "event_id");
  const epId = required(form, "ep_id");

  await db(ctx).prepare(`DELETE FROM event_photographers WHERE id = ?`).bind(epId).run();

  return seeOther(`/admin/events/${eventId}`, "Photographer removed.");
};
