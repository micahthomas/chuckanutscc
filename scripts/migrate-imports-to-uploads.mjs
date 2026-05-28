#!/usr/bin/env node
// One-shot rewrite for the gitignored seeds/imports/*.sql files generated
// before the Drive→upload-token migration. Drops `drive_*` columns from
// photos / event_photographers INSERTs and removes drive_sync_state rows.
//
// Safe to run multiple times — already-converted files are a no-op.
//
// Usage:  node scripts/migrate-imports-to-uploads.mjs

import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIR = join(ROOT, "seeds", "imports");

const files = (await readdir(DIR).catch(() => [])).filter((f) => f.endsWith(".sql"));

for (const f of files) {
  const path = join(DIR, f);
  let sql = await readFile(path, "utf-8");
  const before = sql;

  // 1) Drop the whole `INSERT OR REPLACE INTO drive_sync_state ...VALUES(...);`
  //    (and any trailing newline).
  sql = sql.replace(
    /INSERT OR REPLACE INTO drive_sync_state[\s\S]*?\);[ \t]*\n?/g,
    "",
  );

  // 2) event_photographers: drop the drive_folder_url column + matching value.
  sql = sql.replace(
    /INSERT OR IGNORE INTO event_photographers\s*\(\s*id,\s*event_id,\s*photographer_id,\s*drive_folder_url,\s*created_at\s*\)\s*VALUES\s*\(\s*('[^']*'),\s*('[^']*'),\s*('[^']*'),\s*'[^']*',\s*(\d+)\s*\);/g,
    "INSERT OR IGNORE INTO event_photographers (id, event_id, photographer_id, created_at)\nVALUES ($1, $2, $3, $4);",
  );

  // 3) photographers: add upload_token column with a random value.
  sql = sql.replace(
    /INSERT OR IGNORE INTO photographers\s*\(\s*id,\s*slug,\s*name,\s*active,\s*created_at,\s*updated_at\s*\)\s*VALUES\s*\(\s*('[^']*'),\s*('[^']*'),\s*('[^']*'),\s*1,\s*(\d+),\s*(\d+)\s*\);/g,
    "INSERT OR IGNORE INTO photographers (id, slug, name, active, upload_token, created_at, updated_at)\nVALUES ($1, $2, $3, 1, lower(hex(randomblob(16))), $4, $5);",
  );

  // 4) photos: drop drive_file_id, drive_folder_url, drive_uploaded_at;
  //    rename synced_at -> uploaded_at; add sort_order NULL.
  //
  //    Old column order:
  //      id, event_id, photographer_id, drive_file_id, drive_folder_url, filename,
  //      exif_taken_at, drive_uploaded_at, width, height,
  //      r2_key_thumb, r2_key_display, r2_key_full, status, synced_at
  //
  //    Captures (15 values, only 12 carried over):
  //      $1 id           $2 event_id      $3 photographer_id
  //      $4 drive_file_id (drop)          $5 drive_folder_url (drop)
  //      $6 filename     $7 exif_taken_at $8 drive_uploaded_at (drop)
  //      $9 width        $10 height
  //      $11 r2_key_thumb $12 r2_key_display $13 r2_key_full
  //      $14 status      $15 synced_at  (becomes uploaded_at)
  sql = sql.replace(
    /INSERT OR REPLACE INTO photos\s*\(\s*id,\s*event_id,\s*photographer_id,\s*drive_file_id,\s*drive_folder_url,\s*filename,\s*exif_taken_at,\s*drive_uploaded_at,\s*width,\s*height,\s*r2_key_thumb,\s*r2_key_display,\s*r2_key_full,\s*status,\s*synced_at\s*\)\s*VALUES\s*\(\s*('[^']*'),\s*('[^']*'),\s*('[^']*'),\s*('[^']*'),\s*('[^']*'),\s*('[^']*'),\s*(\d+|NULL),\s*(\d+|NULL),\s*(\d+|NULL),\s*(\d+|NULL),\s*('[^']*'),\s*('[^']*'),\s*('[^']*'),\s*('[^']*'),\s*(\d+|NULL)\s*\);/g,
    "INSERT OR REPLACE INTO photos\n  (id, event_id, photographer_id, filename,\n   exif_taken_at, uploaded_at, width, height,\n   r2_key_thumb, r2_key_display, r2_key_full, sort_order, status)\nVALUES ($1, $2, $3, $6,\n  $7, $15, $9, $10,\n  $11, $12, $13, NULL, $14);",
  );

  if (sql === before) {
    console.log(`  skip   ${f} (already migrated)`);
    continue;
  }
  await writeFile(path, sql);
  console.log(`  fixed  ${f}`);
}

console.log("Done.");
