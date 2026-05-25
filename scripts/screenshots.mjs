#!/usr/bin/env node
// Quick screenshot helper. Captures the headline pages so the user can see the
// current visual state without opening a browser.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] ?? "http://localhost:4321";
const OUT = new URL("../verify-shots", import.meta.url).pathname;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();

const targets = [
  ["00-home",          "/"],
  ["01-events-list",   "/events"],
  ["02-event-cup2",    "/events/2026-autocross-cup-2"],
  ["03-event-cup3",    "/events/2026-autocross-cup-3"],
  ["04-gallery-list",  "/gallery"],
  ["05-gallery-cup2",  "/gallery/2026-autocross-cup-2"],
  ["06-about",         "/about"],
  ["07-autocross",     "/autocross"],
  ["08-membership",    "/membership"],
];

for (const [name, path] of targets) {
  process.stdout.write(`${name} ${path} … `);
  const resp = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`✓ HTTP ${resp?.status() ?? "??"}`);
}

await browser.close();
console.log(`Screenshots in ${OUT}/`);
