#!/usr/bin/env node
// End-to-end verification of the offline demo. Drives the system Chromium
// directly so it doesn't depend on Playwright's bundled browser.
//
// Run with the dev server already up on :4321:
//   pnpm dev          # in one terminal
//   node scripts/verify.mjs

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = "http://localhost:4321";
const SHOTS = new URL("../verify-shots", import.meta.url).pathname;
await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const failures = [];
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") {
    consoleErrors.push(`${page.url()}: ${msg.text()}`);
  }
});
page.on("pageerror", (err) => {
  consoleErrors.push(`${page.url()}: pageerror ${err.message}`);
});

async function visit(label, path, opts = {}) {
  const url = `${BASE}${path}`;
  process.stdout.write(`→ ${label} ${url} ... `);
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    const status = resp?.status() ?? 0;
    if (status !== 200) {
      failures.push(`${label} returned HTTP ${status}`);
      console.log(`✖ HTTP ${status}`);
      return;
    }
    if (opts.expect) {
      // textContent isn't affected by CSS text-transform; lowercase compare for resilience.
      const text = (await page.locator("body").textContent() ?? "").toLowerCase();
      for (const needle of [].concat(opts.expect)) {
        if (!text.includes(needle.toLowerCase())) {
          failures.push(`${label}: expected text "${needle}" not found`);
          console.log(`✖ missing "${needle}"`);
          return;
        }
      }
    }
    if (opts.shot) {
      await page.screenshot({ path: `${SHOTS}/${opts.shot}.png`, fullPage: true });
    }
    console.log("✓");
  } catch (err) {
    failures.push(`${label}: ${err.message}`);
    console.log(`✖ ${err.message}`);
  }
}

// ---------- Public pages ----------
console.log("\n== Public pages ==");
await visit("Homepage",          "/",                                  { expect: ["Chuckanut Sports Car Club", "Spring Autocross #1", "Spring season kicks off"], shot: "01-home" });
await visit("Events list",       "/events",                            { expect: ["Spring Autocross #1", "Annual Banquet", "Winter Karting Social"], shot: "02-events" });
await visit("Event detail",      "/events/2026-spring-autocross-1",    { expect: ["Spring Autocross #1", "Northwest Washington Fairgrounds", "Register on MotorsportReg"], shot: "03-event-detail" });
await visit("Membership",        "/membership",                        { expect: ["Individual", "Family"], shot: "04-membership" });
await visit("Merch list",        "/merch",                             { expect: ["CSCC Club T-Shirt", "CSCC Sticker Pack"], shot: "05-merch" });
await visit("Merch detail",      "/merch/club-tee",                    { expect: ["CSCC Club T-Shirt", "Request this item"], shot: "06-merch-detail" });
await visit("Gallery (empty)",   "/gallery",                           { shot: "07-gallery-empty" });
await visit("Photographers",     "/photographers",                     { expect: ["Alice Chen", "Bob Martinez"], shot: "08-photographers" });
await visit("Photographer page", "/photographers/alice-chen",          { expect: ["Alice Chen", "Bellingham-based"], shot: "09-photographer-detail" });
await visit("About page",        "/about",                             { expect: ["About CSCC", "Founded in 1956"], shot: "10-about" });
await visit("Autocross page",    "/autocross",                         { expect: ["What is autocross", "Helmet rules"], shot: "11-autocross" });
await visit("Contact form",      "/contact",                           { expect: ["Contact us", "Send message"], shot: "12-contact" });

// ---------- Public form submissions ----------
console.log("\n== Public form submissions ==");
await visit("Contact form GET",  "/contact");
const contactForm = page.locator('form[action="/api/contact"]');
await contactForm.locator('input[name="name"]').fill("Test Person");
await contactForm.locator('input[name="email"]').fill("test@example.com");
await contactForm.locator('textarea[name="message"]').fill("Test message from verify.mjs");
await Promise.all([
  page.waitForURL(/\/contact\?flash=/, { timeout: 10000 }),
  contactForm.locator('button[type="submit"]').click(),
]);
console.log("→ Contact submission ✓");

await visit("Merch request GET", "/merch/club-tee");
const merchForm = page.locator('form[action="/api/merch/request"]');
await merchForm.locator('input[name="name"]').fill("Test Person");
await merchForm.locator('input[name="email"]').fill("test@example.com");
await merchForm.locator('select[name="opt_Size"]').selectOption("L");
await merchForm.locator('select[name="opt_Color"]').selectOption("Black");
await Promise.all([
  page.waitForURL(/\/merch\/club-tee\?flash=/, { timeout: 10000 }),
  merchForm.locator('button[type="submit"]').click(),
]);
console.log("→ Merch request submission ✓");

// Newsletter footer subscribe
await visit("Homepage for newsletter", "/");
const newsletterForm = page.locator('form[action="/api/newsletter/subscribe"]');
await newsletterForm.locator('input[name="email"]').fill("verify-newsletter@example.com");
await Promise.all([
  page.waitForURL(/flash=/, { timeout: 10000 }),
  newsletterForm.locator('button[type="submit"]').click(),
]);
console.log("→ Newsletter subscribe ✓");

// Membership mock checkout — first tier (Individual). The flow is:
//   /membership → POST /api/membership/checkout → redirect to mock-checkout page
//   → user clicks "Pay" → POST /api/membership/mock-checkout → /membership/thanks
await visit("Membership form GET", "/membership");
const membershipForm = page.locator('form[action="/api/membership/checkout"]').first();
await membershipForm.locator('input[name="name"]').fill("Verify Member");
await membershipForm.locator('input[name="email"]').fill("verify-member@example.com");
await Promise.all([
  page.waitForURL(/mock-checkout/, { timeout: 15000 }),
  membershipForm.locator('button[type="submit"]').click(),
]);
await page.screenshot({ path: `${SHOTS}/13a-membership-mock-checkout.png`, fullPage: true });
await Promise.all([
  page.waitForURL(/membership\/thanks/, { timeout: 15000 }),
  page.locator('button[type="submit"]').click(),
]);
await page.screenshot({ path: `${SHOTS}/13b-membership-thanks.png`, fullPage: true });
console.log("→ Mock membership checkout ✓");

// ---------- Admin pages ----------
console.log("\n== Admin pages ==");
await visit("Admin dashboard",       "/admin",                                 { expect: ["Dashboard", "Upcoming events", "Active members"], shot: "20-admin-dashboard" });
await visit("Admin events list",     "/admin/events",                          { expect: ["Spring Autocross #1", "Winter Karting Social"], shot: "21-admin-events" });
await visit("Admin event edit",      "/admin/events/evt_spring_ax1",           { expect: ["Spring Autocross #1", "Photographers"], shot: "22-admin-event-edit" });
await visit("Admin event new",       "/admin/events/new",                      { expect: ["New event", "Title"], shot: "23-admin-event-new" });
await visit("Admin pages list",      "/admin/pages",                           { expect: ["About the Club", "Autocross Rules"], shot: "24-admin-pages" });
await visit("Admin page edit",       "/admin/pages/page_about",                { expect: ["About the Club", "Body (Markdown)"], shot: "25-admin-page-edit" });
await visit("Admin photographers",   "/admin/photographers",                   { expect: ["Alice Chen", "Bob Martinez"], shot: "26-admin-photographers" });
await visit("Admin photographer edit","/admin/photographers/photog_alice",     { expect: ["Alice Chen"], shot: "27-admin-photographer-edit" });
await visit("Admin photos",          "/admin/photos",                          { expect: ["Photos"], shot: "28-admin-photos-empty" });
await visit("Admin members list",    "/admin/members",                         { expect: ["Jane Doe", "Bob Smith"], shot: "29-admin-members" });
await visit("Admin member edit",     "/admin/members/mbr_jane",                { expect: ["Jane Doe", "Payment history"], shot: "30-admin-member-edit" });
await visit("Admin merch list",      "/admin/merch",                           { expect: ["CSCC Club T-Shirt", "CSCC Sticker Pack"], shot: "31-admin-merch" });
await visit("Admin merch edit",      "/admin/merch/mch_tee",                   { expect: ["CSCC Club T-Shirt", "Options"], shot: "32-admin-merch-edit" });
await visit("Admin merch requests",  "/admin/requests?status=all",             { expect: ["CSCC Club T-Shirt", "CSCC Sticker Pack"], shot: "33-admin-requests" });
await visit("Admin subscribers",     "/admin/subscribers",                     { expect: ["jane@example.com"], shot: "34-admin-subscribers" });
await visit("Admin contact inbox",   "/admin/contact?status=all",              { expect: ["Frank Liu", "Sara Kim"], shot: "35-admin-contact" });
await visit("Admin contact detail",  "/admin/contact/contact_1",               { expect: ["Frank Liu", "Reply via email"], shot: "36-admin-contact-detail" });
await visit("Admin reminders",       "/admin/reminders",                       { expect: ["Process due reminders"], shot: "37-admin-reminders" });
await visit("Admin emails log",      "/admin/emails",                          { expect: ["Email log"], shot: "38-admin-emails" });
await visit("Admin settings",        "/admin/settings",                        { expect: ["Site settings", "Announcement banner"], shot: "39-admin-settings" });
await visit("Admin tier edit",       "/admin/settings/tiers/individual",       { expect: ["Individual tier", "Annual price"], shot: "40-admin-tier-edit" });

// ---------- Photographer upload URL ----------
console.log("\n== Photographer upload URL ==");
await visit(
  "Photographer landing",
  "/p/demo-alice-token-aaaaaaaaaaaaaaaa",
  { expect: ["Welcome, Alice Chen"], shot: "41-photographer-landing" },
);

// The /gallery URL still exists from the legacy Wix import — it should render
// even with no new uploads, because those rows survive the migration.
await visit("Gallery (legacy archive)", "/gallery", { shot: "42-gallery" });

// ---------- Reminder processing ----------
console.log("\n== Reminder processing ==");
await visit("Reminders before run", "/admin/reminders");
const processBtn = page.locator('form[action="/admin/api/reminders/process"] button');
await Promise.all([
  page.waitForURL(/\/admin\/reminders\?flash=/, { timeout: 30000 }),
  processBtn.click(),
]);
await page.screenshot({ path: `${SHOTS}/44-admin-reminders-processed.png`, fullPage: true });
console.log("→ Reminders processed ✓");

await visit("Email log after reminders", "/admin/emails", { shot: "45-admin-emails-after" });

// ---------- Wrap up ----------
console.log("\n== Summary ==");
console.log(`Console errors: ${consoleErrors.length}`);
if (consoleErrors.length) {
  for (const e of consoleErrors.slice(0, 20)) console.log(`  • ${e}`);
}
console.log(`Failures:       ${failures.length}`);
if (failures.length) {
  for (const f of failures) console.log(`  • ${f}`);
}

await browser.close();
process.exit(failures.length > 0 ? 1 : 0);
