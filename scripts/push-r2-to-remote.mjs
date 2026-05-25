#!/usr/bin/env node
// Mirrors every object in the local Miniflare R2 bucket to remote R2 via
// wrangler. Slow but reliable — one wrangler invocation per object.
// Run once after `pnpm wrangler r2 bucket create cscc-media` to seed the
// production bucket with everything you've imported locally.

import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BUCKET = "cscc-media";

// Miniflare stores R2 buckets under a hashed Durable-Object directory; the
// per-bucket sqlite file's name isn't the bucket name. Find it by scanning
// for the one that contains the _mf_objects table.
const DO_DIR = join(PROJECT_ROOT, ".wrangler", "state", "v3", "r2", "miniflare-R2BucketObject");
if (!existsSync(DO_DIR)) {
  console.error(`Local R2 state not found at ${DO_DIR}.`);
  console.error("Run `pnpm db:seed:local` and the import scripts first.");
  process.exit(1);
}

const candidates = readdirSync(DO_DIR).filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
let metadataDb;
let blobsDir;
for (const file of candidates) {
  const path = join(DO_DIR, file);
  const tryDb = new DatabaseSync(path, { readOnly: true });
  const table = tryDb.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = '_mf_objects'",
  ).get();
  if (!table) { tryDb.close(); continue; }
  // Found it. Blobs sit in `<bucket-name>/blobs/`, addressed by blob_id.
  metadataDb = tryDb;
  blobsDir = join(PROJECT_ROOT, ".wrangler", "state", "v3", "r2", BUCKET, "blobs");
  break;
}
if (!metadataDb || !blobsDir) {
  console.error("Couldn't find Miniflare R2 metadata sqlite. Has the local bucket been populated?");
  process.exit(1);
}

const rows = metadataDb.prepare(
  "SELECT key, blob_id, http_metadata FROM _mf_objects ORDER BY key",
).all();
metadataDb.close();

const BLOBS_DIR = blobsDir;

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
