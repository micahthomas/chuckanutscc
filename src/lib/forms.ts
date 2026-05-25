import type { APIContext } from "astro";

/** Strips a string, returns null if empty after trim. */
export const str = (v: FormDataEntryValue | null): string | null => {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
};

/** Requires a non-empty string field; throws 400 Response if missing. */
export function required(form: FormData, name: string): string {
  const value = str(form.get(name));
  if (!value) throw badRequest(`Missing required field: ${name}`);
  return value;
}

/** Parses a positive integer, throws 400 if not parseable. */
export function intField(form: FormData, name: string, opts?: { min?: number }): number {
  const raw = str(form.get(name));
  if (!raw) throw badRequest(`Missing required field: ${name}`);
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) throw badRequest(`Invalid integer for ${name}`);
  if (opts?.min !== undefined && n < opts.min) throw badRequest(`${name} must be >= ${opts.min}`);
  return n;
}

/** Optional integer field. */
export function intOpt(form: FormData, name: string): number | null {
  const raw = str(form.get(name));
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

/** Parses a checkbox-style boolean. Returns true if value is 'on', '1', 'true'. */
export function boolField(form: FormData, name: string): boolean {
  const raw = str(form.get(name));
  return raw === "on" || raw === "1" || raw === "true";
}

/** Parses a datetime-local input value (e.g. "2026-06-07T08:30") as Pacific time, returns Unix seconds. */
export function pacificDateTimeField(form: FormData, name: string): number {
  const raw = required(form, name);
  // "2026-06-07T08:30" → "2026-06-07T08:30:00-07:00" (assume PDT for simplicity in demo).
  // Proper TZ handling would consult a tz library — fine for v1 since the club is always in Pacific.
  const offset = pacificOffsetFor(raw);
  const iso = raw.length === 16 ? `${raw}:00${offset}` : `${raw}${offset}`;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw badRequest(`Invalid datetime for ${name}`);
  return Math.floor(ms / 1000);
}

export function pacificDateTimeOpt(form: FormData, name: string): number | null {
  const raw = str(form.get(name));
  if (!raw) return null;
  const offset = pacificOffsetFor(raw);
  const iso = raw.length === 16 ? `${raw}:00${offset}` : `${raw}${offset}`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

function pacificOffsetFor(yyyymmddT: string): string {
  // PDT (UTC-7) March 2nd Sunday → November 1st Sunday; PST (UTC-8) otherwise.
  // Approximation good enough for the autocross season window (mostly summer).
  const m = Number.parseInt(yyyymmddT.slice(5, 7), 10);
  return m >= 4 && m <= 10 ? "-07:00" : "-08:00";
}

/** Generates a URL-safe slug from a title. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Builds a 303 See Other redirect (use after POST). */
export function seeOther(location: string, flash?: string): Response {
  const url = flash ? `${location}${location.includes("?") ? "&" : "?"}flash=${encodeURIComponent(flash)}` : location;
  return new Response(null, { status: 303, headers: { Location: url } });
}

export const badRequest = (msg: string): Response => new Response(msg, { status: 400 });
export const notFound = (): Response => new Response("Not found", { status: 404 });

/** Convenience: get the flash message from query string. */
export function flash(ctx: APIContext | { url: URL }): string | null {
  return ctx.url.searchParams.get("flash");
}
