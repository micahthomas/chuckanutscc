#!/usr/bin/env node
// Resizes the Wix-gallery downloads (see scrape-wix-gallery.mjs) into our
// thumb+display WebP pair, uploads to local R2 under imports/legacy/, and
// writes seeds/imports/legacy_gallery.sql so the photos land in D1 attached
// to a synthetic "Pre-2024 Highlights" event under an "Archive" season.
//
// Usage:
//   node scripts/scrape-wix-gallery.mjs --download /tmp/wix-gallery
//   node scripts/import-legacy-gallery.mjs --src /tmp/wix-gallery

import { spawn } from "node:child_process";
import { readdir, mkdir, writeFile, stat, rm } from "node:fs/promises";
import { join, basename, extname, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import exifr from "exifr";

const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const args = parseArgs(process.argv.slice(2));
const SRC = args.src;
if (!SRC) {
  console.error("Usage: import-legacy-gallery.mjs --src DIR");
  process.exit(1);
}

const BUCKET = "cscc-media";
const DB_NAME = "cscc";
const SEASON_ID = "season_archive";
const SEASON_SLUG = "archive";
const EVENT_ID = "evt_legacy";
const EVENT_SLUG = "pre-2024-highlights";
const PHOTOG_ID = "photog_club_archive";
const PHOTOG_SLUG = "club-archive";
const FOLDER_URL = "https://www.chuckanutscc.org/gallery";

// Skip the chrome PNGs (logos / icons) and the handful of hashes that
// import-wix-images.sh already provisions as branding / hero / shop.
const SKIP_HASHES = new Set([
  // Logos / icons
  "8bb02f_7732bf62958043a485f1a6aafbc567d9",
  "4057345bcf57474b96976284050c00df",
  "e1aa082f7c0747168d9cf43e77046142",
  // Already imported as branding, hero, gallery-1..4
  "33a8cd_a9adbfc49da04de9ab8ca39fc68de9f9",
  "8bb02f_74739ccea3ff49ac871ee681c6338c4e",
  "8bb02f_ee6564ab0e0841608b1bcbab0437251f",
  "79de41_9c56374df18a4eaaa525dbed46f61dd6",
  "8bb02f_b2bfb327a87942e7a4b8ec1c583e0b37",
]);

const all = await readdir(SRC);
const entries = all
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  .filter((f) => {
    const stem = basename(f, extname(f)).replace("~mv2", "");
    if (SKIP_HASHES.has(stem)) return false;
    if (/\.png$/i.test(f)) return false;        // gallery is photos, not PNG icons
    return true;
  })
  .sort();

console.log(`Importing ${entries.length} of ${all.length} files from ${SRC}.`);
if (entries.length === 0) process.exit(0);

const tmp = await mkdir(join(tmpdir(), `cscc-legacy-${process.pid}`), { recursive: true })
  ?? join(tmpdir(), `cscc-legacy-${process.pid}`);

console.log("Resizing…");
// Spread photos missing EXIF dates evenly across pre-2024 so they sort
// behind real event photos but stay deterministic across re-imports.
const FALLBACK_START = Math.floor(new Date("2020-06-01T12:00:00Z").getTime() / 1000);
const FALLBACK_END   = Math.floor(new Date("2023-12-31T12:00:00Z").getTime() / 1000);
const fallbackStep   = entries.length > 1 ? Math.floor((FALLBACK_END - FALLBACK_START) / (entries.length - 1)) : 0;

const records = [];
let resized = 0;
for (let idx = 0; idx < entries.length; idx++) {
  const filename = entries[idx];
  const sourcePath = join(SRC, filename);
  const stem = basename(filename, extname(filename)).replace(/[^A-Za-z0-9]/g, "_").slice(0, 32);
  const photoId = `p_legacy_${stem}`.slice(0, 48);

  const thumbPath = join(tmp, `${photoId}_thumb.webp`);
  const displayPath = join(tmp, `${photoId}_display.webp`);

  // `.rotate()` with no args applies the EXIF Orientation tag so the
  // emitted WebP is upright (and the tag is stripped from the output —
  // browsers don't honor EXIF on WebP). Without this, portrait photos
  // shot on phones display sideways.
  const img = sharp(sourcePath, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  await img.clone().resize({ width: 400 }).webp({ quality: 78 }).toFile(thumbPath);
  await img.clone().resize({ width: 1600 }).webp({ quality: 82 }).toFile(displayPath);

  // Real capture time from EXIF if present; otherwise a deterministic
  // pre-2024 timestamp so legacy photos sort under recent event photos
  // in the time-ordered gallery instead of pretending to be "just taken".
  let takenAt = null;
  try {
    const exif = await exifr.parse(sourcePath, { tiff: true, pick: ["DateTimeOriginal", "CreateDate", "ModifyDate"] });
    const d = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.ModifyDate;
    if (d instanceof Date && !isNaN(d.getTime())) takenAt = Math.floor(d.getTime() / 1000);
  } catch { /* not all jpegs carry exif */ }
  if (!takenAt) takenAt = FALLBACK_START + idx * fallbackStep;

  records.push({
    photoId,
    filename,
    thumbPath, displayPath,
    thumbKey: `imports/legacy/${photoId}/thumb.webp`,
    displayKey: `imports/legacy/${photoId}/display.webp`,
    driveFileId: `legacy_${stem}`,
    width: meta.width ?? null,
    height: meta.height ?? null,
    takenAt,
  });

  resized++;
  process.stdout.write(`  resized ${resized}/${entries.length}\r`);
}
process.stdout.write("\n");

console.log("Uploading to local R2…");
let uploaded = 0;
for (const r of records) {
  await wranglerWithRetry(["r2", "object", "put", `${BUCKET}/${r.thumbKey}`,
    "--file", r.thumbPath, "--content-type=image/webp", "--local"]);
  await wranglerWithRetry(["r2", "object", "put", `${BUCKET}/${r.displayKey}`,
    "--file", r.displayPath, "--content-type=image/webp", "--local"]);
  uploaded++;
  process.stdout.write(`  uploaded ${uploaded}/${records.length}\r`);
}
process.stdout.write("\n");

console.log("Writing SQL…");
const esc = (v) => v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;
const now = Math.floor(Date.now() / 1000);
const lines = [
  `-- Auto-generated by import-legacy-gallery.mjs at ${new Date().toISOString()}`,
  ``,
  `INSERT OR IGNORE INTO seasons (id, slug, year, name, description_md, is_current, created_at, updated_at)`,
  `VALUES (${esc(SEASON_ID)}, ${esc(SEASON_SLUG)}, 2023, 'Archive',`,
  `        'Selected photos from previous seasons (pre-2024), pulled from the legacy chuckanutscc.org gallery.', 0, ${now}, ${now});`,
  ``,
  `INSERT OR IGNORE INTO events (id, slug, title, event_type, status, start_at, end_at,`,
  `   location_name, description_md, season_id, created_at, updated_at)`,
  `VALUES (${esc(EVENT_ID)}, ${esc(EVENT_SLUG)}, 'Pre-2024 Highlights', 'other', 'completed',`,
  `   ${new Date("2023-12-31T00:00:00Z").getTime() / 1000 | 0}, NULL,`,
  `   NULL, 'A selection of photos carried over from the previous club gallery.',`,
  `   ${esc(SEASON_ID)}, ${now}, ${now});`,
  ``,
  `INSERT OR IGNORE INTO photographers (id, slug, name, active, created_at, updated_at)`,
  `VALUES (${esc(PHOTOG_ID)}, ${esc(PHOTOG_SLUG)}, 'Club Archive', 1, ${now}, ${now});`,
  ``,
  `INSERT OR IGNORE INTO event_photographers (id, event_id, photographer_id, drive_folder_url, created_at)`,
  `VALUES (${esc(`ep_${EVENT_ID}_${PHOTOG_ID}`)}, ${esc(EVENT_ID)}, ${esc(PHOTOG_ID)}, ${esc(FOLDER_URL)}, ${now});`,
  ``,
  `INSERT OR REPLACE INTO drive_sync_state (drive_folder_url, last_synced_at, last_page_token, last_error, last_error_at)`,
  `VALUES (${esc(FOLDER_URL)}, ${now}, NULL, NULL, NULL);`,
  ``,
];
for (const r of records) {
  lines.push(
    `INSERT OR REPLACE INTO photos (id, event_id, photographer_id, drive_file_id, drive_folder_url,`,
    `   filename, exif_taken_at, drive_uploaded_at, width, height,`,
    `   r2_key_thumb, r2_key_display, r2_key_full, status, synced_at)`,
    `VALUES (${esc(r.photoId)}, ${esc(EVENT_ID)}, ${esc(PHOTOG_ID)},`,
    `   ${esc(r.driveFileId)}, ${esc(FOLDER_URL)}, ${esc(r.filename)},`,
    `   ${r.takenAt}, ${r.takenAt}, ${r.width ?? "NULL"}, ${r.height ?? "NULL"},`,
    `   ${esc(r.thumbKey)}, ${esc(r.displayKey)}, ${esc(r.displayKey)}, 'live', ${now});`,
    ``,
  );
}

const importsDir = join(PROJECT_ROOT, "seeds", "imports");
await mkdir(importsDir, { recursive: true });
const sqlPath = join(importsDir, "legacy_gallery.sql");
await writeFile(sqlPath, lines.join("\n"));
console.log(`Wrote ${sqlPath}`);

console.log("Applying SQL to local D1…");
await wrangler(["d1", "execute", DB_NAME, "--local", `--file=${sqlPath}`]);

await rm(tmp, { recursive: true, force: true });
console.log(`Done. ${records.length} photo(s) imported under ${EVENT_ID}.`);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) { out[key] = next; i++; }
      else { out[key] = true; }
    }
  }
  return out;
}

function wrangler(a) {
  return new Promise((resolve, reject) => {
    const c = spawn("pnpm", ["wrangler", ...a], { stdio: ["ignore", "pipe", "pipe"], cwd: PROJECT_ROOT });
    let err = "";
    c.stderr.on("data", (d) => err += d.toString());
    c.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`wrangler ${a.join(" ")} failed (${code}): ${err}`)));
  });
}

async function wranglerWithRetry(a, n = 3) {
  for (let i = 0; i < n; i++) {
    try { await wrangler(a); return; }
    catch (e) { if (i === n - 1) throw e; await new Promise((r) => setTimeout(r, 250 * (i + 1))); }
  }
}
