import type { APIRoute } from "astro";
import { db, now } from "~/lib/db";
import { assertPhotographerEvent } from "~/lib/photographer-auth";

/**
 * Toggle a photo's status between `live` and `hidden`. Only photos owned by
 * the calling photographer on this event are touchable — anything else is a
 * 404 (don't leak existence).
 */
export const POST: APIRoute = async (ctx) => {
  const token = ctx.params.token as string;
  const eventId = ctx.params.eventId as string;

  let session;
  try {
    session = await assertPhotographerEvent(ctx, token, eventId);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  const { photographer, event } = session;

  const body = await ctx.request.json().catch(() => null) as { photoId?: string } | null;
  const photoId = body?.photoId;
  if (!photoId) return Response.json({ error: "photoId required" }, { status: 400 });

  const row = await db(ctx)
    .prepare(
      `SELECT status FROM photos
       WHERE id = ? AND event_id = ? AND photographer_id = ?`,
    )
    .bind(photoId, event.id, photographer.id)
    .first<{ status: string }>();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  const next = row.status === "live" ? "hidden" : "live";
  await db(ctx)
    .prepare(
      `UPDATE photos SET status = ?, hidden_at = ?, hidden_by = ?
       WHERE id = ?`,
    )
    .bind(
      next,
      next === "hidden" ? now() : null,
      next === "hidden" ? `photographer:${photographer.id}` : null,
      photoId,
    )
    .run();

  return Response.json({ status: next });
};
