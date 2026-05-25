/**
 * Tiny client for the public Scorekeeper API at scorekeeper.wwscc.org.
 *
 * The site uses these endpoints to render the season UI; they're CORS-open
 * with `authtype=none`, so we can call them server-side or client-side.
 *
 * Used by the admin event form to give officers a dropdown of real events
 * instead of pasting URLs by hand. Falls back gracefully on any error so
 * manual entry always works.
 */

const BASE = "https://scorekeeper.wwscc.org";
const TIMEOUT_MS = 4000;

export interface ScorekeeperEvent {
  /** Full eventid UUID. */
  eventid: string;
  /** First 8 hex chars — what the public results URL uses. */
  shortId: string;
  name: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  location: string | null;
  /** Computed URLs for convenience. */
  resultsUrl: string;
  registrationUrl: string;
}

interface ApiSeriesInfo {
  success: boolean;
  seriesinfo?: {
    events?: Array<{
      eventid: string;
      name: string;
      date: string;
      location?: string | null;
    }>;
  };
}

export async function fetchScorekeeperEvents(series: string): Promise<ScorekeeperEvent[]> {
  if (!series) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${BASE}/api2?items=seriesinfo&series=${encodeURIComponent(series)}&authtype=none`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as ApiSeriesInfo;
    if (!data.success || !data.seriesinfo?.events) return [];

    return data.seriesinfo.events.map((e) => {
      const shortId = e.eventid.slice(0, 8);
      return {
        eventid: e.eventid,
        shortId,
        name: e.name,
        date: e.date,
        location: e.location ?? null,
        resultsUrl: `${BASE}/results/${series}/${shortId}`,
        registrationUrl: `${BASE}/register/${series}/events`,
      };
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
