import type { APIContext } from "astro";
import { countPhotos, loadRecentPhotos } from "~/lib/queries";
import { db } from "~/lib/db";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 60;

export async function GET(ctx: APIContext): Promise<Response> {
  const url = ctx.url;
  const eventSlug = url.searchParams.get("event");
  const countOnly = url.searchParams.get("count") === "1";

  // Resolve slug → id (so callers can use the same slug as the page URL).
  let eventId: string | null = null;
  if (eventSlug) {
    const row = await db(ctx)
      .prepare(`SELECT id FROM events WHERE slug = ?`)
      .bind(eventSlug)
      .first<{ id: string }>();
    if (!row) return json({ error: "event not found" }, 404);
    eventId = row.id;
  }

  if (countOnly) {
    const count = await countPhotos(ctx, { eventId });
    return json({ count });
  }

  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT));

  const [rows, total] = await Promise.all([
    loadRecentPhotos(ctx, { eventId, limit, offset }),
    countPhotos(ctx, { eventId }),
  ]);

  const photos = rows.map((p) => ({
    id: p.id,
    thumb: p.r2_key_thumb,
    display: p.r2_key_display,
    full: p.r2_key_full,
    photographer: p.photographer_name,
    photographerSlug: p.photographer_slug,
    eventTitle: p.event_title,
    eventSlug: p.event_slug,
    width: p.width,
    height: p.height,
  }));

  return json({
    photos,
    total,
    offset,
    limit,
    hasMore: offset + photos.length < total,
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
