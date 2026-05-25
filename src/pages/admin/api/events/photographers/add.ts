import type { APIRoute } from "astro";
import { db, now } from "~/lib/db";
import { newId } from "~/lib/id";
import { required, str, seeOther } from "~/lib/forms";

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const form = await ctx.request.formData();

  const eventId = required(form, "event_id");
  const photographerId = required(form, "photographer_id");
  const driveFolderUrl = required(form, "drive_folder_url");
  const notes = str(form.get("notes"));

  await db(ctx)
    .prepare(
      `INSERT INTO event_photographers (id, event_id, photographer_id, drive_folder_url, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (event_id, photographer_id) DO UPDATE SET
         drive_folder_url = excluded.drive_folder_url,
         notes = excluded.notes`,
    )
    .bind(newId(), eventId, photographerId, driveFolderUrl, notes, now())
    .run();

  return seeOther(`/admin/events/${eventId}`, "Photographer assigned.");
};
