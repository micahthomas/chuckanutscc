import type { APIRoute } from "astro";
import { db } from "~/lib/db";
import { assertPhotographerEvent } from "~/lib/photographer-auth";

/**
 * Bulk reorder: client sends the full ordered list of photo IDs for this
 * photographer/event and the server writes sort_order = index+1 for each.
 *
 * Works for every reorder UI — drag-and-drop, jump-to-top/bottom, and the
 * step arrows — because the client always just computes the new ordering
 * locally and POSTs the result.
 *
 * The submitted list is validated against the database: every ID must belong
 * to this (photographer, event), and the set must match exactly. We refuse
 * partial reorders so a stale page can't silently lose photos.
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

  const body = await ctx.request.json().catch(() => null) as { photoIds?: unknown } | null;
  const submitted = body?.photoIds;
  if (!Array.isArray(submitted) || !submitted.every((id) => typeof id === "string")) {
    return Response.json({ error: "photoIds (string[]) required" }, { status: 400 });
  }
  const photoIds = submitted as string[];

  const { results } = await db(ctx)
    .prepare(
      `SELECT id FROM photos WHERE event_id = ? AND photographer_id = ?`,
    )
    .bind(event.id, photographer.id)
    .all<{ id: string }>();
  const owned = new Set(results.map((r) => r.id));

  if (photoIds.length !== owned.size || photoIds.some((id) => !owned.has(id))) {
    return Response.json(
      { error: "Submitted list does not match this event's photos. Refresh and try again." },
      { status: 409 },
    );
  }

  const stmts = photoIds.map((id, i) =>
    db(ctx)
      .prepare(`UPDATE photos SET sort_order = ? WHERE id = ?`)
      .bind(i + 1, id),
  );
  await db(ctx).batch(stmts);

  return Response.json({ ok: true, count: photoIds.length });
};
