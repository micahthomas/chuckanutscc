#!/usr/bin/env node
// Mirrors every object in the local Miniflare R2 bucket to remote R2 via
// wrangler. Slow but reliable — one wrangler invocation per object.
// Run once after `pnpm wrangler r2 bucket create cscc-media` to seed the
// production bucket with everything you've imported locally.

import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BUCKET = "cscc-media";
const STATE_DIR = join(PROJECT_ROOT, ".wrangler", "state", "v3", "r2", BUCKET);
const DB_PATH = join(STATE_DIR, "db.sqlite");
const BLOBS_DIR = join(STATE_DIR, "blobs");

if (!existsSync(DB_PATH)) {
  console.error(`Local R2 state not found at ${DB_PATH}.`);
  console.error("Run `pnpm db:seed:local` and the import scripts first.");
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH, { readOnly: true });
// Miniflare's R2 metadata layout: _mf_objects(key, blob_id, http_metadata, ...).
const rows = db.prepare(
  "SELECT key, blob_id, http_metadata FROM _mf_objects ORDER BY key",
).all();
db.close();

console.log(`Pushing ${rows.length} object(s) to remote ${BUCKET}…`);

let pushed = 0;
let failed = 0;
for (const row of rows) {
  const key = String(row.key);
  const blobId = String(row.blob_id);
  const blobPath = join(BLOBS_DIR, blobId);
  if (!existsSync(blobPath)) {
    console.warn(`  skip ${key}: blob ${blobId} missing on disk`);
    failed++;
    continue;
  }
  const meta = parseMetadata(row.http_metadata);
  const contentType = meta.contentType ?? "application/octet-stream";

  try {
    await wrangler([
      "r2", "object", "put", `${BUCKET}/${key}`,
      "--file", blobPath,
      "--content-type", contentType,
      "--remote",
    ]);
    pushed++;
    if (pushed % 10 === 0) {
      process.stdout.write(`  pushed ${pushed}/${rows.length}\r`);
    }
  } catch (err) {
    console.error(`\n  failed ${key}: ${err.message}`);
    failed++;
  }
}

process.stdout.write("\n");
console.log(`Done. ${pushed} succeeded, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);

function parseMetadata(raw) {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  // Miniflare stores it as a Buffer in some versions.
  if (raw instanceof Uint8Array) {
    try { return JSON.parse(new TextDecoder().decode(raw)); } catch { return {}; }
  }
  return raw;
}

function wrangler(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["wrangler", ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: PROJECT_ROOT,
    });
    let stderr = "";
    child.stderr.on("data", (d) => stderr += d.toString());
    child.on("exit", (code) => {
      if (code !== 0) reject(new Error(`wrangler ${args.join(" ")} failed (${code}): ${stderr.slice(0, 200)}`));
      else resolve();
    });
  });
}
