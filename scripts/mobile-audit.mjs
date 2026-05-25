#!/usr/bin/env node
// Mobile responsiveness audit. Loads every public page at a phone viewport,
// captures a full-page screenshot, and reports anything horizontally
// scrollable or noticeably broken.
//
// Usage:
//   node scripts/mobile-audit.mjs                    # against localhost:4321
//   node scripts/mobile-audit.mjs https://example.com
import { chromium, devices } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2]?.replace(/\/$/, "") ?? "http://localhost:4321";
const OUT = new URL("../verify-shots/mobile", import.meta.url).pathname;
await mkdir(OUT, { recursive: true });

const PAGES = [
  ["00-home",            "/"],
  ["01-events",          "/events"],
  ["02-events-past",     "/events?season=2024"],
  ["03-event-detail",    "/events/2026-autocross-cup-2"],
  ["04-event-upcoming",  "/events/2026-autocross-cup-3"],
  ["05-locations",       "/locations"],
  ["06-location-detail", "/locations/bellis-fair-mall"],
  ["07-membership",      "/membership"],
  ["08-shop",            "/shop"],
  ["09-shop-detail",     "/shop/heavyweight-hoodie"],
  ["10-gallery",         "/gallery"],
  ["11-gallery-filtered","/gallery?event=2026-autocross-cup-2"],
  ["12-event-gallery",   "/gallery/2026-autocross-cup-2"],
  ["13-photographers",   "/photographers"],
  ["14-photographer",    "/photographers/peter-zuidmeer"],
  ["15-about",           "/about"],
  ["16-autocross",       "/autocross"],
  ["17-contact",         "/contact"],
];

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true });
// iPhone 14 Pro: 393×852 logical px, DPR 3.
const ctx = await browser.newContext({
  ...devices["iPhone 14 Pro"],
});
const page = await ctx.newPage();

const issues = [];
console.log(`Mobile audit against ${BASE}\n`);

for (const [name, path] of PAGES) {
  const url = `${BASE}${path}`;
  process.stdout.write(`${name.padEnd(24)} ${path.padEnd(46)} `);
  const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 25000 }).catch((e) => ({ error: e }));
  if ("error" in (resp ?? {})) {
    process.stdout.write(`✖ ${resp.error.message}\n`);
    issues.push({ name, path, type: "load-error", detail: resp.error.message });
    continue;
  }
  await page.waitForTimeout(400);

  // Horizontal overflow check: scrollWidth shouldn't exceed viewport width.
  const overflow = await page.evaluate(() => {
    const w = document.documentElement.scrollWidth;
    const vw = window.innerWidth;
    if (w <= vw + 1) return null;
    // Find the wide elements responsible for the overflow.
    const offenders = [];
    const all = document.body.querySelectorAll("*");
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width < w) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || "").toString().slice(0, 60),
          width: Math.round(r.width),
          right: Math.round(r.right),
        });
      }
    }
    return { docWidth: w, viewportWidth: vw, offenders: offenders.slice(0, 5) };
  });

  // Tap-target audit: links / buttons smaller than 32×32 are awkward on touch.
  const smallTaps = await page.evaluate(() => {
    const els = document.querySelectorAll("a, button, [role='button'], input, select, textarea");
    const small = [];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;       // hidden
      if (r.bottom < 0 || r.top > window.innerHeight * 4) continue; // far off-screen
      if (r.width < 32 || r.height < 32) {
        small.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || "").trim().slice(0, 24),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    }
    return small.slice(0, 5);
  });

  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const status = `HTTP ${resp.status()}`;
  const flags = [];
  if (overflow) flags.push(`overflow ${overflow.docWidth}px`);
  if (smallTaps.length) flags.push(`${smallTaps.length} small taps`);
  process.stdout.write(`${status}${flags.length ? "  ⚠ " + flags.join(", ") : "  ✓"}\n`);

  if (overflow) issues.push({ name, path, type: "horizontal-overflow", detail: overflow });
  if (smallTaps.length) issues.push({ name, path, type: "small-tap-targets", detail: smallTaps });
}

console.log(`\nScreenshots: ${OUT}/`);
console.log(`Issues:      ${issues.length}\n`);
for (const i of issues) {
  console.log(`  [${i.type}] ${i.name} ${i.path}`);
  if (i.type === "horizontal-overflow") {
    console.log(`    document is ${i.detail.docWidth}px in a ${i.detail.viewportWidth}px viewport`);
    for (const o of i.detail.offenders) {
      console.log(`    - <${o.tag}> width=${o.width} right=${o.right} class="${o.cls}"`);
    }
  } else if (i.type === "small-tap-targets") {
    for (const t of i.detail) {
      console.log(`    - <${t.tag}> ${t.w}×${t.h}px "${t.text}"`);
    }
  } else {
    console.log(`    ${JSON.stringify(i.detail).slice(0, 200)}`);
  }
}

await browser.close();
process.exit(issues.filter((i) => i.type === "load-error" || i.type === "horizontal-overflow").length > 0 ? 1 : 0);
