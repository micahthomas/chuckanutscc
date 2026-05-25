#!/usr/bin/env node
// Applies seeds/demo.sql + every seeds/imports/*.sql file to REMOTE D1.
// Mirror of seed-local.mjs but with --remote. Run after `wrangler d1 create`
// + `db:migrate:remote` on a fresh production database.

import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DB = "cscc";

async function applyFile(file) {
  process.stdout.write(`→ ${file}\n`);
  await new Promise((resolve, reject) => {
    const proc = spawn("pnpm", ["wrangler", "d1", "execute", DB, "--remote", `--file=${file}`], {
      cwd: ROOT,
      stdio: ["ignore", "ignore", "inherit"],
    });
    proc.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`failed (${code})`)));
  });
}

await applyFile(join(ROOT, "seeds", "demo.sql"));

const importsDir = join(ROOT, "seeds", "imports");
try {
  await stat(importsDir);
  const files = (await readdir(importsDir)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    await applyFile(join(importsDir, f));
  }
  if (files.length > 0) console.log(`Applied ${files.length} import file(s).`);
} catch {
  // imports/ dir doesn't exist — nothing to apply.
}

console.log("Remote D1 seeded.");
