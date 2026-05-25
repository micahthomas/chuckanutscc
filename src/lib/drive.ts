import type { APIContext } from "astro";
import { env } from "cloudflare:workers";
import { db, media, now } from "./db";
import { newId } from "./id";

const PALETTE = [
  "#1d3a6b", "#2c4a7e", "#5b8def", "#7f9cf5",
  "#f97316", "#dc2626", "#16a34a", "#0891b2",
  "#9333ea", "#db2777", "#0f766e", "#a16207",
];

interface SyncResult {
  mode: "live" | "offline";
  added: number;
  folderUrl: string;
}

/**
 * Syncs photos from all event_photographer Drive folders into R2 + D1.
 *
 * If GOOGLE_SERVICE_ACCOUNT_JSON is set, calls the real Drive API.
 * Otherwise (offline mode) generates 6 placeholder SVG photos per
 * unsynced (event_photographer, sync_state) pair, so the gallery UI has
 * real content to display.
 */
export async function syncAllFolders(ctx: APIContext): Promise<SyncResult[]> {
  const live = !!env.GOOGLE_SERVICE_ACCOUNT_JSON;

  const { results } = await db(ctx)
    .prepare(
      `SELECT ep.id, ep.event_id, ep.photographer_id, ep.drive_folder_url,
              s.last_synced_at
       FROM event_photographers ep
       LEFT JOIN drive_sync_state s ON s.drive_folder_url = ep.drive_folder_url`,
    )
    .all<{
      id: string;
      event_id: string;
      photographer_id: string;
      drive_folder_url: string;
      last_synced_at: number | null;
    }>();

  const out: SyncResult[] = [];
  for (const folder of results) {
    if (live) {
      out.push(await syncLive(ctx, folder));
    } else {
      out.push(await syncOffline(ctx, folder));
    }
  }
  return out;
}

async function syncOffline(
  ctx: APIContext,
  folder: { event_id: string; photographer_id: string; drive_folder_url: string; last_synced_at: number | null },
): Promise<SyncResult> {
  // Only generate on the first sync per folder so re-running the simulator
  // doesn't keep multiplying photos.
  if (folder.last_synced_at !== null) {
    await markSynced(ctx, folder.drive_folder_url, null);
    return { mode: "offline", added: 0, folderUrl: folder.drive_folder_url };
  }

  const photographer = await db(ctx)
    .prepare(`SELECT name FROM photographers WHERE id = ?`)
    .bind(folder.photographer_id)
    .first<{ name: string }>();
  const event = await db(ctx)
    .prepare(`SELECT title, slug FROM events WHERE id = ?`)
    .bind(folder.event_id)
    .first<{ title: string; slug: string }>();

  if (!photographer || !event) return { mode: "offline", added: 0, folderUrl: folder.drive_folder_url };

  const count = 6;
  for (let i = 1; i <= count; i++) {
    const photoId = newId();
    const driveFileId = `mock_${folder.event_id}_${folder.photographer_id}_${i}`;
    const color = PALETTE[(i + folder.event_id.charCodeAt(0)) % PALETTE.length];
    const label = `${event.title.slice(0, 32)} — ${i}`;
    const svg = placeholderSvg(label, color);

    // Placeholder SVGs scale infinitely, so one upload per photo serves
    // every requested size.
    const key = `events/${folder.event_id}/${photoId}/placeholder.svg`;
    await media(ctx).put(key, svg, {
      httpMetadata: { contentType: "image/svg+xml" },
    });

    await db(ctx)
      .prepare(
        `INSERT INTO photos (id, event_id, photographer_id, drive_file_id, drive_folder_url,
                             filename, exif_taken_at, drive_uploaded_at, width, height,
                             r2_key_thumb, r2_key_display, r2_key_full, status, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'live', ?)
         ON CONFLICT (drive_file_id) DO NOTHING`,
      )
      .bind(
        photoId, folder.event_id, folder.photographer_id, driveFileId, folder.drive_folder_url,
        `${event.slug}-${i}.svg`, now(), 800, 600,
        key, key, key,
        now(),
      )
      .run();
  }

  await markSynced(ctx, folder.drive_folder_url, null);
  return { mode: "offline", added: count, folderUrl: folder.drive_folder_url };
}

async function syncLive(
  ctx: APIContext,
  folder: { drive_folder_url: string; last_synced_at: number | null },
): Promise<SyncResult> {
  // Real Drive API integration would live here. For now, mark as synced and
  // return 0 — implementation deferred until needed in production.
  await markSynced(ctx, folder.drive_folder_url, "Live Drive sync not yet implemented");
  return { mode: "live", added: 0, folderUrl: folder.drive_folder_url };
}

async function markSynced(ctx: APIContext, folderUrl: string, error: string | null): Promise<void> {
  await db(ctx)
    .prepare(
      `INSERT INTO drive_sync_state (drive_folder_url, last_synced_at, last_error, last_error_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (drive_folder_url) DO UPDATE SET
         last_synced_at = excluded.last_synced_at,
         last_error = excluded.last_error,
         last_error_at = excluded.last_error_at`,
    )
    .bind(folderUrl, now(), error, error ? now() : null)
    .run();
}

function placeholderSvg(label: string, color: string): string {
  const escaped = label.replace(/[<>&"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" } as Record<string, string>)[c]!);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <rect width="800" height="600" fill="${color}"/>
  <text x="400" y="305" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-size="32" font-weight="600">${escaped}</text>
</svg>`;
}
