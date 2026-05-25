#!/usr/bin/env node
// One-off: pull the Scorekeeper season index and print each event's
// title + per-event results URL. Used to seed real results_url values.
import { chromium } from "playwright";

const URL_ = process.argv[2] ?? "https://scorekeeper.wwscc.org/results/cscc2026";

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true });
const page = await browser.newContext().then((c) => c.newPage());
await page.goto(URL_, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

// Dump every link on the page so we can see what's actually rendered.
const all = await page.$$eval("a", (links) =>
  links.map((a) => ({ href: a.getAttribute("href"), text: a.textContent?.trim().slice(0, 80) ?? "" }))
       .filter((e) => e.href && e.text),
);
console.log("All anchors:");
console.log(JSON.stringify(all, null, 2));
console.log("---");
console.log("Body text sample:");
console.log((await page.locator("body").innerText()).slice(0, 2000));
await browser.close();
