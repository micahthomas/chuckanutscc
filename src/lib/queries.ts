import type { APIContext, AstroGlobal } from "astro";
import { db, now } from "./db";

export type Settings = Record<string, string>;

export async function loadSettings(ctx: APIContext | AstroGlobal): Promise<Settings> {
  const { results } = await db(ctx)
    .prepare("SELECT key, value FROM settings")
    .all<{ key: string; value: string }>();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
}

export interface EventRow {
  id: string;
  slug: string;
  title: string;
  event_type: string;
  status: string;
  start_at: number;
  end_at: number | null;
  location_name: string | null;
  description_md: string;
  registration_url: string | null;
  results_url: string | null;
  fee_member_cents: number | null;
  fee_nonmember_cents: number | null;
  hero_image_key?: string | null;
  course_map_image_key?: string | null;
  location_id?: string | null;
  /**
   * R2 key of a random live photo to render when `hero_image_key` is null.
   * Populated by `attachFallbackHeroes` after the main events query so cards
   * never look bare. The actual stored value isn't touched.
   */
  fallback_hero_key?: string | null;
}

/**
 * For any events without an explicit hero image, pick a random live photo
 * from the gallery as a visual fallback. Same request always gives the same
 * fallbacks (one query for the whole batch), but successive requests vary.
 */
async function attachFallbackHeroes<T extends EventRow>(
  ctx: APIContext | AstroGlobal,
  events: T[],
): Promise<T[]> {
  const needsFallback = events.filter((e) => !e.hero_image_key);
  if (needsFallback.length === 0) return events;

  // Cards render the fallback at ~400px wide, so pull the thumbnail variant
  // (~400px @ q78 WebP) instead of the full display image (1600px @ q82) —
  // the display variant ballooned card payloads to >1MB each on the homepage.
  const { results } = await db(ctx)
    .prepare(
      `SELECT r2_key_thumb FROM photos
       WHERE status = 'live'
       ORDER BY random()
       LIMIT ?`,
    )
    .bind(needsFallback.length)
    .all<{ r2_key_thumb: string }>();

  let i = 0;
  return events.map((e) => {
    if (e.hero_image_key) return e;
    const fb = results[i++]?.r2_key_thumb ?? null;
    return { ...e, fallback_hero_key: fb };
  });
}

export interface SeasonRow {
  id: string;
  slug: string;
  year: number;
  name: string;
  description_md: string;
  is_current: number;
  /** Scorekeeper series id for this season — falls back to settings.scorekeeper_series when blank. */
  scorekeeper_series: string | null;
}

const SEASON_COLS = "id, slug, year, name, description_md, is_current, scorekeeper_series";

export async function loadSeasons(ctx: APIContext | AstroGlobal): Promise<SeasonRow[]> {
  const { results } = await db(ctx)
    .prepare(`SELECT ${SEASON_COLS} FROM seasons ORDER BY year DESC`)
    .all<SeasonRow>();
  return results;
}

export async function loadSeasonBySlug(
  ctx: APIContext | AstroGlobal,
  slug: string,
): Promise<SeasonRow | null> {
  return await db(ctx)
    .prepare(`SELECT ${SEASON_COLS} FROM seasons WHERE slug = ?`)
    .bind(slug)
    .first<SeasonRow>();
}

export async function loadSeason(
  ctx: APIContext | AstroGlobal,
  id: string,
): Promise<SeasonRow | null> {
  return await db(ctx)
    .prepare(`SELECT ${SEASON_COLS} FROM seasons WHERE id = ?`)
    .bind(id)
    .first<SeasonRow>();
}

export async function loadCurrentSeason(
  ctx: APIContext | AstroGlobal,
): Promise<SeasonRow | null> {
  const flagged = await db(ctx)
    .prepare(`SELECT ${SEASON_COLS} FROM seasons WHERE is_current = 1 ORDER BY year DESC LIMIT 1`)
    .first<SeasonRow>();
  if (flagged) return flagged;
  return await db(ctx)
    .prepare(`SELECT ${SEASON_COLS} FROM seasons ORDER BY year DESC LIMIT 1`)
    .first<SeasonRow>();
}

export async function loadSeasonEvents(
  ctx: APIContext | AstroGlobal,
  seasonId: string,
): Promise<EventRow[]> {
  const { results } = await db(ctx)
    .prepare(
      `SELECT id, slug, title, event_type, status, start_at, end_at,
              location_name, description_md, registration_url, results_url,
              fee_member_cents, fee_nonmember_cents, hero_image_key,
              course_map_image_key, location_id
       FROM events WHERE season_id = ?
       ORDER BY start_at ASC`,
    )
    .bind(seasonId)
    .all<EventRow>();
  return await attachFallbackHeroes(ctx, results);
}

export interface LocationRow {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  map_image_key: string | null;
  description_md: string;
  directions_md: string;
  sort_order: number;
  active: number;
}

export async function loadLocations(
  ctx: APIContext | AstroGlobal,
  opts: { activeOnly?: boolean } = {},
): Promise<LocationRow[]> {
  const where = opts.activeOnly ? "WHERE active = 1" : "";
  const { results } = await db(ctx)
    .prepare(
      `SELECT id, slug, name, address, latitude, longitude,
              map_image_key, description_md, directions_md, sort_order, active
       FROM locations ${where}
       ORDER BY sort_order ASC, name ASC`,
    )
    .all<LocationRow>();
  return results;
}

export async function loadLocation(
  ctx: APIContext | AstroGlobal,
  id: string,
): Promise<LocationRow | null> {
  return await db(ctx)
    .prepare(
      `SELECT id, slug, name, address, latitude, longitude,
              map_image_key, description_md, directions_md, sort_order, active
       FROM locations WHERE id = ?`,
    )
    .bind(id)
    .first<LocationRow>();
}

export async function loadLocationBySlug(
  ctx: APIContext | AstroGlobal,
  slug: string,
): Promise<LocationRow | null> {
  return await db(ctx)
    .prepare(
      `SELECT id, slug, name, address, latitude, longitude,
              map_image_key, description_md, directions_md, sort_order, active
       FROM locations WHERE slug = ?`,
    )
    .bind(slug)
    .first<LocationRow>();
}

export async function loadUpcomingEvents(
  ctx: APIContext | AstroGlobal,
  limit = 25,
): Promise<EventRow[]> {
  const { results } = await db(ctx)
    .prepare(
      `SELECT id, slug, title, event_type, status, start_at, end_at,
              location_name, description_md, registration_url, results_url,
              fee_member_cents, fee_nonmember_cents, hero_image_key,
              course_map_image_key, location_id
       FROM events
       WHERE status IN ('scheduled', 'postponed') AND start_at >= ?
       ORDER BY start_at ASC
       LIMIT ?`,
    )
    .bind(now(), limit)
    .all<EventRow>();
  return await attachFallbackHeroes(ctx, results);
}

export async function loadPastEvents(
  ctx: APIContext | AstroGlobal,
  limit = 10,
): Promise<EventRow[]> {
  const { results } = await db(ctx)
    .prepare(
      `SELECT id, slug, title, event_type, status, start_at, end_at,
              location_name, description_md, registration_url, results_url,
              fee_member_cents, fee_nonmember_cents, hero_image_key,
              course_map_image_key, location_id
       FROM events
       WHERE status = 'completed' OR start_at < ?
       ORDER BY start_at DESC
       LIMIT ?`,
    )
    .bind(now(), limit)
    .all<EventRow>();
  return await attachFallbackHeroes(ctx, results);
}

export interface DashboardCounts {
  events_total: number;
  events_upcoming: number;
  members_active: number;
  members_expired: number;
  merch_requests_open: number;
  contact_new: number;
  photos_live: number;
  photos_hidden: number;
}

export interface PageRow {
  id: string;
  slug: string;
  title: string;
  body_md: string;
  show_in_nav: number;
  nav_order: number;
  seo_title: string | null;
  seo_description: string | null;
  updated_at: number;
}

export interface HomePageRow {
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image_key: string | null;
  hero_cta_text: string | null;
  hero_cta_url: string | null;
  featured_event_mode: string;
  pinned_event_id: string | null;
}

export async function loadHomePage(
  ctx: APIContext | AstroGlobal,
): Promise<HomePageRow | null> {
  return await db(ctx)
    .prepare(
      `SELECT hero_title, hero_subtitle, hero_image_key,
              hero_cta_text, hero_cta_url,
              featured_event_mode, pinned_event_id
       FROM home_page WHERE id = 1`,
    )
    .first<HomePageRow>();
}

export async function loadPageBySlug(
  ctx: APIContext | AstroGlobal,
  slug: string,
): Promise<PageRow | null> {
  return await db(ctx)
    .prepare(
      `SELECT id, slug, title, body_md, show_in_nav, nav_order,
              seo_title, seo_description, updated_at
       FROM pages WHERE slug = ?`,
    )
    .bind(slug)
    .first<PageRow>();
}

export async function loadEventBySlug(
  ctx: APIContext | AstroGlobal,
  slug: string,
): Promise<EventRow | null> {
  return await db(ctx)
    .prepare(
      `SELECT id, slug, title, event_type, status, start_at, end_at,
              location_name, description_md, registration_url, results_url,
              fee_member_cents, fee_nonmember_cents, hero_image_key,
              course_map_image_key, location_id
       FROM events WHERE slug = ?`,
    )
    .bind(slug)
    .first<EventRow>();
}

export interface EventPhotographerRow {
  id: string;
  photographer_id: string;
  photographer_name: string;
  photographer_slug: string;
  notes: string | null;
}

export async function loadEventPhotographers(
  ctx: APIContext | AstroGlobal,
  eventId: string,
): Promise<EventPhotographerRow[]> {
  const { results } = await db(ctx)
    .prepare(
      `SELECT ep.id, ep.photographer_id, p.name AS photographer_name,
              p.slug AS photographer_slug, ep.notes
       FROM event_photographers ep
       JOIN photographers p ON p.id = ep.photographer_id
       WHERE ep.event_id = ?
       ORDER BY p.name`,
    )
    .bind(eventId)
    .all<EventPhotographerRow>();
  return results;
}

export interface PhotoRow {
  id: string;
  event_id: string;
  photographer_id: string;
  photographer_name: string;
  photographer_slug: string;
  filename: string;
  r2_key_thumb: string;
  r2_key_display: string;
  r2_key_full: string;
  exif_taken_at: number | null;
  uploaded_at: number;
  sort_order: number | null;
  status: string;
  width: number | null;
  height: number | null;
}

/**
 * `sort_order` (when set) wins over EXIF time so photographers can pin
 * specific shots to the front of their event gallery. The COALESCE pushes
 * un-pinned photos to the end of the sort window.
 */
const PHOTO_ORDER_BY =
  "COALESCE(ph.sort_order, 999999) ASC, COALESCE(ph.exif_taken_at, ph.uploaded_at) ASC";

export async function loadEventPhotos(
  ctx: APIContext | AstroGlobal,
  eventId: string,
  opts: {
    status?: "live" | "hidden" | "rejected" | "all";
    photographerId?: string;
  } = {},
): Promise<PhotoRow[]> {
  const statusFilter = opts.status ?? "live";
  const clauses: string[] = ["ph.event_id = ?"];
  const binds: unknown[] = [eventId];
  if (statusFilter !== "all") {
    clauses.push("ph.status = ?");
    binds.push(statusFilter);
  }
  if (opts.photographerId) {
    clauses.push("ph.photographer_id = ?");
    binds.push(opts.photographerId);
  }
  const { results } = await db(ctx)
    .prepare(
      `SELECT ph.id, ph.event_id, ph.photographer_id,
              p.name AS photographer_name, p.slug AS photographer_slug,
              ph.filename, ph.r2_key_thumb, ph.r2_key_display, ph.r2_key_full,
              ph.exif_taken_at, ph.uploaded_at, ph.sort_order,
              ph.status, ph.width, ph.height
       FROM photos ph
       JOIN photographers p ON p.id = ph.photographer_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY ${PHOTO_ORDER_BY}`,
    )
    .bind(...binds)
    .all<PhotoRow>();
  return results;
}

export interface RecentPhotoRow {
  id: string;
  event_id: string;
  event_title: string;
  event_slug: string;
  photographer_id: string;
  photographer_name: string;
  photographer_slug: string;
  filename: string;
  r2_key_thumb: string;
  r2_key_display: string;
  r2_key_full: string;
  exif_taken_at: number | null;
  uploaded_at: number;
  sort_order: number | null;
  width: number | null;
  height: number | null;
}

/**
 * Most-recent live photos across all events (or filtered to one event id).
 * Joined with event + photographer so the gallery can attribute each photo
 * without further queries.
 */
export async function loadRecentPhotos(
  ctx: APIContext | AstroGlobal,
  opts: { limit?: number; offset?: number; eventId?: string | null } = {},
): Promise<RecentPhotoRow[]> {
  const limit = opts.limit ?? 60;
  const offset = opts.offset ?? 0;
  const where = opts.eventId ? "AND ph.event_id = ?" : "";
  const binds: unknown[] = opts.eventId ? [opts.eventId, limit, offset] : [limit, offset];
  const { results } = await db(ctx)
    .prepare(
      `SELECT ph.id, ph.event_id, e.title AS event_title, e.slug AS event_slug,
              ph.photographer_id, p.name AS photographer_name, p.slug AS photographer_slug,
              ph.filename, ph.r2_key_thumb, ph.r2_key_display, ph.r2_key_full,
              ph.exif_taken_at, ph.uploaded_at, ph.sort_order, ph.width, ph.height
       FROM photos ph
       JOIN events e ON e.id = ph.event_id
       JOIN photographers p ON p.id = ph.photographer_id
       WHERE ph.status = 'live' ${where}
       ORDER BY
         ph.sort_order IS NULL ASC,                              -- pinned first (NOT NULL → 0)
         ph.sort_order ASC,                                       -- in the photographer's order
         COALESCE(ph.exif_taken_at, ph.uploaded_at) DESC         -- everything else by recency
       LIMIT ? OFFSET ?`,
    )
    .bind(...binds)
    .all<RecentPhotoRow>();
  return results;
}

export async function countPhotos(
  ctx: APIContext | AstroGlobal,
  opts: { eventId?: string | null } = {},
): Promise<number> {
  const where = opts.eventId ? "AND event_id = ?" : "";
  const binds: unknown[] = opts.eventId ? [opts.eventId] : [];
  const row = await db(ctx)
    .prepare(`SELECT COUNT(*) AS c FROM photos WHERE status = 'live' ${where}`)
    .bind(...binds)
    .first<{ c: number }>();
  return row?.c ?? 0;
}

export interface MembershipTierRow {
  id: string;
  name: string;
  description_md: string | null;
  annual_price_cents: number;
  benefits_json: string;
  sort_order: number;
  visible: number;
}

export async function loadMembershipTiers(
  ctx: APIContext | AstroGlobal,
  opts: { visibleOnly?: boolean } = {},
): Promise<MembershipTierRow[]> {
  const where = opts.visibleOnly ? "WHERE visible = 1" : "";
  const { results } = await db(ctx)
    .prepare(
      `SELECT id, name, description_md, annual_price_cents, benefits_json,
              sort_order, visible
       FROM membership_tiers ${where}
       ORDER BY sort_order ASC, name ASC`,
    )
    .all<MembershipTierRow>();
  return results;
}

export async function loadMembershipTier(
  ctx: APIContext | AstroGlobal,
  id: string,
): Promise<MembershipTierRow | null> {
  return await db(ctx)
    .prepare(
      `SELECT id, name, description_md, annual_price_cents, benefits_json,
              sort_order, visible
       FROM membership_tiers WHERE id = ?`,
    )
    .bind(id)
    .first<MembershipTierRow>();
}

export interface MerchItemRow {
  id: string;
  slug: string;
  title: string;
  description_md: string;
  images_json: string;
  options_json: string;
  available: number;
  notes: string | null;
  sort_order: number;
}

export async function loadMerchItems(
  ctx: APIContext | AstroGlobal,
  opts: { availableOnly?: boolean } = {},
): Promise<MerchItemRow[]> {
  const where = opts.availableOnly ? "WHERE available = 1" : "";
  const { results } = await db(ctx)
    .prepare(
      `SELECT id, slug, title, description_md, images_json, options_json,
              available, notes, sort_order
       FROM merch_items ${where}
       ORDER BY sort_order ASC, title ASC`,
    )
    .all<MerchItemRow>();
  return results;
}

export async function loadMerchItemBySlug(
  ctx: APIContext | AstroGlobal,
  slug: string,
): Promise<MerchItemRow | null> {
  return await db(ctx)
    .prepare(
      `SELECT id, slug, title, description_md, images_json, options_json,
              available, notes, sort_order
       FROM merch_items WHERE slug = ?`,
    )
    .bind(slug)
    .first<MerchItemRow>();
}

export interface GalleryEventRow {
  id: string;
  slug: string;
  title: string;
  start_at: number;
  season_year: number | null;
  photo_count: number;
}

export async function loadGalleryEvents(
  ctx: APIContext | AstroGlobal,
): Promise<GalleryEventRow[]> {
  const { results } = await db(ctx)
    .prepare(
      `SELECT e.id, e.slug, e.title, e.start_at,
              s.year AS season_year,
              COUNT(ph.id) AS photo_count
       FROM events e
       LEFT JOIN photos ph ON ph.event_id = e.id AND ph.status = 'live'
       LEFT JOIN seasons s ON s.id = e.season_id
       GROUP BY e.id
       HAVING photo_count > 0
       ORDER BY e.start_at DESC`,
    )
    .all<GalleryEventRow>();
  return results;
}

export interface PhotographerRow {
  id: string;
  slug: string;
  name: string;
  bio_md: string | null;
  headshot_key: string | null;
  portfolio_url: string | null;
  instagram_url: string | null;
  contact_email: string | null;
  active: number;
  upload_token: string;
}

export async function loadPhotographers(
  ctx: APIContext | AstroGlobal,
  opts: { activeOnly?: boolean } = {},
): Promise<PhotographerRow[]> {
  const where = opts.activeOnly ? "WHERE active = 1" : "";
  const { results } = await db(ctx)
    .prepare(
      `SELECT id, slug, name, bio_md, headshot_key, portfolio_url,
              instagram_url, contact_email, active, upload_token
       FROM photographers ${where}
       ORDER BY name`,
    )
    .all<PhotographerRow>();
  return results;
}

export async function loadPhotographerBySlug(
  ctx: APIContext | AstroGlobal,
  slug: string,
): Promise<PhotographerRow | null> {
  return await db(ctx)
    .prepare(
      `SELECT id, slug, name, bio_md, headshot_key, portfolio_url,
              instagram_url, contact_email, active, upload_token
       FROM photographers WHERE slug = ?`,
    )
    .bind(slug)
    .first<PhotographerRow>();
}

export async function loadPhotographerEvents(
  ctx: APIContext | AstroGlobal,
  photographerId: string,
): Promise<EventRow[]> {
  const { results } = await db(ctx)
    .prepare(
      `SELECT DISTINCT e.id, e.slug, e.title, e.event_type, e.status, e.start_at, e.end_at,
              e.location_name, e.description_md, e.registration_url, e.results_url,
              e.fee_member_cents, e.fee_nonmember_cents, e.hero_image_key,
              e.course_map_image_key, e.location_id
       FROM events e
       JOIN event_photographers ep ON ep.event_id = e.id
       WHERE ep.photographer_id = ?
       ORDER BY e.start_at DESC`,
    )
    .bind(photographerId)
    .all<EventRow>();
  return await attachFallbackHeroes(ctx, results);
}

export async function loadDashboardCounts(
  ctx: APIContext | AstroGlobal,
): Promise<DashboardCounts> {
  const ts = now();
  const row = await db(ctx)
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM events) AS events_total,
         (SELECT COUNT(*) FROM events WHERE status IN ('scheduled','postponed') AND start_at >= ?) AS events_upcoming,
         (SELECT COUNT(*) FROM members WHERE expires_at >= ?) AS members_active,
         (SELECT COUNT(*) FROM members WHERE expires_at < ?) AS members_expired,
         (SELECT COUNT(*) FROM merch_requests WHERE status = 'open') AS merch_requests_open,
         (SELECT COUNT(*) FROM contact_submissions WHERE status = 'new') AS contact_new,
         (SELECT COUNT(*) FROM photos WHERE status = 'live') AS photos_live,
         (SELECT COUNT(*) FROM photos WHERE status = 'hidden') AS photos_hidden`,
    )
    .bind(ts, ts, ts)
    .first<DashboardCounts>();
  return (
    row ?? {
      events_total: 0,
      events_upcoming: 0,
      members_active: 0,
      members_expired: 0,
      merch_requests_open: 0,
      contact_new: 0,
      photos_live: 0,
      photos_hidden: 0,
    }
  );
}
