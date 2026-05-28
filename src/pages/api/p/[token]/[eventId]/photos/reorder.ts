import type { APIRoute } from "astro";
import { db } from "~/lib/db";
import { assertPhotographerEvent } from "~/lib/photographer-auth";

type Direction = "up" | "down";

/**
 * Moves a single photo one slot earlier (`up`) or later (`down`) in the
 * gallery for this photographer/event. To keep the implementation simple we
 * re-number every photo's sort_order on each swap rather than thinking about
 * NULLs vs. partial coverage — at the volumes a photographer manages
 * (dozens, maybe hundreds for a busy event), one batch of UPDATEs is fine.
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

  const body = await ctx.request.json().catch(() => null) as {
    photoId?: string;
    direction?: Direction;
  } | null;
  const photoId = body?.photoId;
  const direction = body?.direction;
  if (!photoId || (direction !== "up" && direction !== "down")) {
    return Response.json({ error: "photoId + direction required" }, { status: 400 });
  }

  const { results } = await db(ctx)
    .prepare(
      `SELECT id FROM photos
       WHERE event_id = ? AND photographer_id = ?
       ORDER BY COALESCE(sort_order, 999999) ASC,
                COALESCE(exif_taken_at, uploaded_at) ASC`,
    )
    .bind(event.id, photographer.id)
    .all<{ id: string }>();

  const ids = results.map((r) => r.id);
  const idx = ids.indexOf(photoId);
  if (idx === -1) return Response.json({ error: "Not found" }, { status: 404 });

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= ids.length) {
    return Response.json({ ok: true, moved: false });
  }
  [ids[idx], ids[swapIdx]] = [ids[swapIdx]!, ids[idx]!];

  const stmts = ids.map((id, i) =>
    db(ctx)
      .prepare(`UPDATE photos SET sort_order = ? WHERE id = ?`)
      .bind(i + 1, id),
  );
  await db(ctx).batch(stmts);

  return Response.json({ ok: true, moved: true });
};
