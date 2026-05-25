#!/usr/bin/env node
// Renders chuckanutscc.org/gallery in headless Chromium, scrolls until no
// new images load, and collects every wixstatic.com image URL the Pro
// Gallery component requests. Strips the per-render `/v1/...` transform
// suffix so we end up with the original-resolution source URL.
//
// Two modes:
//   --probe                  print the list of URLs and exit (no downloads)
//   --download <out-dir>     download originals into out-dir (skips existing)
//
// Default URL is the live gallery; pass --url <url> to point elsewhere.

import { chromium } from "playwright";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join, basename } from "node:path";
import { pipeline } from "node:stream/promises";

const args = parseArgs(process.argv.slice(2));
const TARGET_URL = args.url ?? "https://www.chuckanutscc.org/gallery";
const PROBE = !!args.probe;
const OUT = args.download ?? null;
if (!PROBE && !OUT) {
  console.error("Usage: scrape-wix-gallery.mjs --probe | --download <dir> [--url URL]");
  process.exit(1);
}
if (OUT) await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
});
const ctx = await browser.newContext({
  viewport: { width: 1400, height: 900 },
});
const page = await ctx.newPage();

const seen = new Set();
page.on("request", (req) => {
  const u = req.url();
  if (!u.includes("static.wixstatic.com/media/")) return;
  if (!/\.(jpe?g|png|webp)/i.test(u)) return;
  // Strip the per-render transform: …/<hash>~mv2.jpg/v1/fill/...jpg
  // → …/<hash>~mv2.jpg
  const original = u.split("/v1/")[0];
  seen.add(original);
});

console.error(`Loading ${TARGET_URL}…`);
await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
// Wix bootstraps its Pro Gallery component after DOMContentLoaded.
// Give it a few seconds of script-execution time before we start scrolling.
await page.waitForTimeout(4000);

// First, scroll vertically a few screens to pull the gallery component
// into view. The Pro Gallery doesn't initialize until visible.
for (let i = 0; i < 6; i++) {
  await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.9));
  await page.waitForTimeout(500);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1000);

// Wix Pro Gallery (slider layout) keeps items in a horizontally-scrollable
// container that lazy-loads as you advance scrollLeft. Pump it until the
// container reports it's at the end, with a safety bound.
let lastCount = 0;
let stableTicks = 0;
for (let pass = 0; pass < 60; pass++) {
  // Scroll the slider container, fall back to a window keypress if it's
  // not the focused element.
  const state = await page.evaluate(() => {
    const el = document.querySelector(".gallery-horizontal-scroll");
    if (!el) return null;
    const step = Math.max(el.clientWidth * 0.85, 400);
    const before = el.scrollLeft;
    el.scrollTo({ left: before + step, behavior: "auto" });
    return {
      before,
      after: el.scrollLeft,
      max: el.scrollWidth - el.clientWidth,
    };
  });
  // Also nudge the page vertically in case the gallery is inside a sticky
  // pane that needs viewport activity to trigger its IntersectionObserver.
  await page.mouse.wheel(800, 0);
  await page.waitForTimeout(900);

  if (state) {
    if (pass % 5 === 0 || seen.size !== lastCount) {
      console.error(`  pass ${pass}: scrollLeft ${state.before|0}→${state.after|0}/${state.max|0}, ${seen.size} images`);
    }
    if (state.after >= state.max - 5 && seen.size === lastCount) break;
  }

  if (seen.size === lastCount) {
    stableTicks++;
    if (stableTicks >= 6) break;
  } else {
    stableTicks = 0;
    lastCount = seen.size;
  }
}

// One last sweep — scroll to far end + back to catch anything still lazy.
await page.evaluate(() => {
  const el = document.querySelector(".gallery-horizontal-scroll");
  if (el) el.scrollTo({ left: el.scrollWidth, behavior: "auto" });
});
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const el = document.querySelector(".gallery-horizontal-scroll");
  if (el) el.scrollTo({ left: 0, behavior: "auto" });
});
await page.waitForTimeout(1000);

await browser.close();

const urls = [...seen].sort();
console.error(`\nCollected ${urls.length} unique image URL(s).`);

if (PROBE) {
  for (const u of urls) console.log(u);
  process.exit(0);
}

// --download mode
console.error(`Downloading to ${OUT}/…`);
let downloaded = 0;
let skipped = 0;
let failed = 0;
for (const u of urls) {
  const name = basename(new URL(u).pathname);
  const out = join(OUT, name);
  try {
    const existing = await stat(out).catch(() => null);
    if (existing && existing.size > 0) { skipped++; continue; }
    const res = await fetch(u, {
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux) AppleWebKit/537.36 Chrome/120.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await pipeline(res.body, createWriteStream(out));
    downloaded++;
    if (downloaded % 10 === 0) process.stdout.write(`  downloaded ${downloaded}\r`);
  } catch (err) {
    console.error(`  failed ${name}: ${err.message}`);
    failed++;
  }
}
process.stdout.write("\n");
console.error(`Done. ${downloaded} downloaded, ${skipped} skipped, ${failed} failed.`);

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
