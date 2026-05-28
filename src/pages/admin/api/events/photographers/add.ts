import type { APIRoute } from "astro";
import { db, now } from "~/lib/db";
import { newId } from "~/lib/id";
import { required, str, seeOther } from "~/lib/forms";

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const form = await ctx.request.formData();

  const eventId = required(form, "event_id");
  const photographerId = required(form, "photographer_id");
  const notes = str(form.get("notes"));

  await db(ctx)
    .prepare(
      `INSERT INTO event_photographers (id, event_id, photographer_id, notes, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (event_id, photographer_id) DO UPDATE SET
         notes = excluded.notes`,
    )
    .bind(newId(), eventId, photographerId, notes, now())
    .run();

  return seeOther(`/admin/events/${eventId}`, "Photographer assigned.");
};
