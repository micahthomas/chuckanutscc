import type { APIContext, AstroGlobal } from "astro";
import { db } from "./db";

export interface PhotographerSession {
  photographer: {
    id: string;
    name: string;
    slug: string;
    upload_token: string;
  };
}

export interface PhotographerEventSession extends PhotographerSession {
  event: {
    id: string;
    slug: string;
    title: string;
    start_at: number;
  };
}

/**
 * Looks up a photographer by their secret upload token. Returns null when
 * the token doesn't match — caller decides whether to 404 the page or the
 * API route.
 */
export async function findPhotographerByToken(
  ctx: APIContext | AstroGlobal,
  token: string,
): Promise<PhotographerSession["photographer"] | null> {
  if (!token) return null;
  return await db(ctx)
    .prepare(
      `SELECT id, name, slug, upload_token
       FROM photographers
       WHERE upload_token = ? AND active = 1`,
    )
    .bind(token)
    .first<PhotographerSession["photographer"]>();
}

/**
 * Token + event-assignment check used by every /p/[token]/[eventId] page and
 * /api/p/[token]/[eventId]/* route. Either returns the resolved photographer
 * + event, or throws a 404 Response so callers can `try { ... } catch (r) { return r }`.
 */
export async function assertPhotographerEvent(
  ctx: APIContext | AstroGlobal,
  token: string,
  eventId: string,
): Promise<PhotographerEventSession> {
  const photographer = await findPhotographerByToken(ctx, token);
  if (!photographer) throw new Response("Not found", { status: 404 });

  const event = await db(ctx)
    .prepare(
      `SELECT e.id, e.slug, e.title, e.start_at
       FROM events e
       JOIN event_photographers ep ON ep.event_id = e.id
       WHERE ep.photographer_id = ? AND e.id = ?`,
    )
    .bind(photographer.id, eventId)
    .first<PhotographerEventSession["event"]>();
  if (!event) throw new Response("Not found", { status: 404 });

  return { photographer, event };
}
