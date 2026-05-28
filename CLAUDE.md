# CLAUDE.md — working notes for AI assistants

Read this first. It covers conventions, gotchas, and patterns that aren't obvious from the source.

## What this is

A rebuild of [chuckanutscc.org](https://www.chuckanutscc.org/) (a Bellingham, WA sports car club, est. 1956) as an Astro + Cloudflare Workers app. Run `pnpm demo` to see it locally with realistic content — that's the fastest way to orient yourself.

## Stack at a glance

- **Astro 6** with `output: "server"` + the `@astrojs/cloudflare` adapter v13
- **Cloudflare Workers** (Static Assets) — single Worker, single deploy
- **D1** for everything persisted, **R2** for images/photos
- **React islands** for any interactivity that's not trivially HTML (`PhotoMosaic`, `MarkdownEditor`, `ImageUpload`, `SatelliteMap`, `PhotographerUploader`, `PhotographerPhotoManager`)
- **Tailwind v4** via `@tailwindcss/vite` — no `tailwind.config.js`, theme tokens live inside `src/styles/global.css`
- **Cloudflare Access** gates `/admin/*` in prod; middleware reads the email from `Cf-Access-Authenticated-User-Email`

## Critical gotchas

### 1. `Astro.locals.runtime.env` was removed in Astro 6

You must read bindings via:

```ts
import { env } from "cloudflare:workers";
const db = env.DB;
```

Never reach for `ctx.locals.runtime.env` — it returns undefined and 500s every page. `src/lib/db.ts` already wraps this; new code that needs env should follow the same pattern.

### 2. `worker-configuration.d.ts` is generated

Don't edit it. Run `pnpm typegen` to regenerate after changing `wrangler.jsonc`. It's gitignored.

### 3. Per-file edit protocol

The harness requires reading a file in the **current turn** before editing it. If `Edit` returns "File has not been read yet", `Read` it again and retry — files don't carry over across turns.

### 4. CSS columns mosaic, not real masonry

`PhotoMosaic` uses `columns-N` (CSS multi-column) to fake a masonry layout — preserves aspect ratios without JS. Tradeoff: the visual order is column-first, not row-first. Acceptable for a photo wall; would be wrong for ordered content.

### 5. Leaflet needs lazy dynamic import

Leaflet touches `window` at module load. Importing it at the top of a React component breaks SSR. `SatelliteMap.tsx` defers `import("leaflet")` inside `useEffect` — match that pattern for any other Leaflet usage.

### 6. The lightbox z-index has to clear Leaflet's panes

Leaflet tile / control panes top out around `z-index: 1000`. The portal-mounted lightbox in `PhotoMosaic.tsx` is at `z-[9999]` for this reason. Don't drop it.

### 7. `<input type="datetime-local">` rejects single-digit days

`toLocalDateTimeInput` in `src/lib/format.ts` uses `day: "2-digit"` for exactly this reason. If you write your own datetime formatter, force 2-digit on every component.

### 8. Two pickers on the event form, one inline `<script>`

The admin event form has both a Scorekeeper picker and a Venue picker. Both populate other fields via vanilla JS in a single inline `<script is:inline>` block at the bottom of `EventForm.astro`. Don't reach for React for this — it's intentionally lightweight.

### 9. Image upload resizes client-side

There's no `sharp` in Workers. `ImageUpload.tsx` resizes via `<canvas>` to WebP **before** uploading. The server route at `/admin/api/upload` only validates + streams to R2.

### 10. Photo / course-map / Wix imports persist as SQL

The import scripts write idempotent SQL to `seeds/imports/*.sql` (gitignored — references R2 objects that only exist in local `.wrangler/state/`). `scripts/seed-local.mjs` and `seed-remote.mjs` apply `demo.sql` plus every file in that directory. To repopulate on a new machine, re-run the import scripts — they're documented in `README.md`.

### 11. Photographer upload flow is secret-URL-gated, not logged-in

Each `photographer` row has an `upload_token` column. Visiting `/p/<token>` lists their assigned events; `/p/<token>/<eventId>` shows their photos and lets them upload more. There is no login — the token is the credential. Token rotation lives at `/admin/api/photographers/regenerate-token`; old URLs 404 the instant a new one is generated.

The browser uploader (`src/components/photographer/PhotographerUploader.tsx`) handles drag-drop, multi-select, and `.zip` archives. ZIPs are streamed via `@zip.js/zip.js` so 500MB+ archives don't blow memory — never replace this with JSZip. Each image is EXIF-read via `exifr` and resized in-browser to a thumb (600px) + display (2400px) WebP before being POSTed with the original to `/api/p/[token]/[eventId]/upload`. No Workers-side image processing is needed and no `sharp` runs in production (it's still used by the Node-side import scripts).

The middleware adds `Cache-Control: no-store` + `X-Robots-Tag: noindex,nofollow` to every `/p/*` and `/api/p/*` response so leaked URLs don't end up cached or indexed.

## Useful commands

```sh
pnpm demo                    # reset + seed + dev
pnpm check                   # TypeScript / Astro check
pnpm db:migrate:local        # apply unapplied migrations
pnpm db:seed:local           # demo.sql + seeds/imports/*.sql
pnpm db:reset:local          # wipe local D1 only (R2 persists)
node scripts/verify.mjs      # end-to-end smoke (Playwright)
node scripts/screenshots.mjs # capture key pages to verify-shots/
```

Wrangler queries are useful for sanity checks:

```sh
pnpm wrangler d1 execute cscc --local --command "SELECT count(*) FROM events"
pnpm wrangler r2 object list cscc-media --local | head
```

## Conventions

- **Queries live in `src/lib/queries.ts`**, mutations in `src/lib/mutations.ts`. Avoid inline SQL in page frontmatter unless it's clearly one-off.
- **`fmtDate` / `fmtTime` / `fmtDateTime` / `fmtMoney`** in `src/lib/format.ts`. Always render through these — they pin the timezone to `America/Los_Angeles` and money to USD cents.
- **Markdown body fields** end in `_md`; render via `renderMarkdown` from `src/lib/markdown.ts`. The same `marked` instance powers the live preview in `MarkdownEditor.tsx`.
- **Slugs** generated via `slugify` in `src/lib/forms.ts` — call it on title/name when the admin leaves the slug blank.
- **All admin forms** POST to `/admin/api/<entity>/save` and redirect via `seeOther()` from `src/lib/forms.ts`. Mirror that pattern for new entities.
- **All settings** are key/value rows in the `settings` table. New keys must be added to the `SETTING_KEYS` allowlist in `src/pages/admin/api/settings/save.ts` to be writeable.
- **Booleans** in D1 are stored as `INTEGER` (0/1). The query layer keeps that shape — render-side checks should compare to `1`, not truthy.
- **Timestamps** are Unix seconds (INTEGER) throughout. Convert ms → s with `Math.floor(Date.now() / 1000)` (helper: `now()` in `src/lib/db.ts`).
- **Don't add `console.log`** in shipped code. Errors that matter should surface through the admin email log or a 4xx/5xx response with context.

## Content page architecture (read before adding a new page)

Every editorial "title + markdown body" page on the public site goes through one shared component pipeline. **Do not create a one-off `.astro` route with a hand-rolled hero**, even if the page has a slightly different look — extend the shared component or add a knob to the `pages` table instead.

The flow:

```
pages table (D1)
  └─ src/pages/[slug].astro
       └─ src/components/public/CmsPage.astro      ← hero + body + optional TOC + print
            └─ src/components/public/PageHero.astro ← eyebrow / title / subtitle / items / CTAs / photo+stat
```

Hero, TOC, and print-button behavior are all **driven by columns on `pages`** (added in migration `0008`):

| column            | what it controls                                                                                  |
|-------------------|---------------------------------------------------------------------------------------------------|
| `eyebrow`         | Small uppercase label above the title (e.g. `Rulebook`, `About Autocross`). Empty → no eyebrow.   |
| `subtitle`        | One paragraph under the title.                                                                    |
| `hero_image_key`  | R2 key for the side photo. Empty → single-column hero.                                            |
| `hero_stat_value` + `hero_stat_label` | Overlay card on the hero photo (e.g. "70+ Years racing…").                    |
| `hero_items_json` | JSON array of strings → ✓ checklist in the hero.                                                  |
| `hero_ctas_json`  | JSON array of `{label, href, primary?}` → buttons in the hero.                                    |
| `show_toc`        | `1` → sticky TOC sidebar built from `## H2` headings. Auto-injects anchor IDs.                    |
| `show_print`      | `1` → "Print or save as PDF" button + print stylesheet (clean black-on-white, hides nav/footer/TOC). |

Admin edits live at `/admin/pages/<id>` (`PageForm.astro`). The CTAs textarea uses a shorthand — `* Label | /url` for primary, `- Label | /url` for outline — that `save.ts` parses back to JSON.

**When to deviate:**
- **Functional pages** (events listing, gallery, membership checkout) keep their own route file but use `<PageHero>` for the hero band — see `/membership.astro` for the pattern. Don't re-implement the hero markup.
- **Per-URL wrappers** are allowed *only* when the URL nesting matters and isn't expressible as a single slug; the wrapper must delegate to `<CmsPage>`, not re-render the chrome.

The TOC auto-injects IDs onto every `<h2>` and `<h3>` and collects `<h2>`s into the sidebar — see `renderMarkdownWithToc` in `src/lib/markdown.ts`. Heading IDs are slugified from the visible text; duplicates get `-2`, `-3`, etc. suffixed.

## Architecture map

```
public visitor
  └─→ Astro page (SSR) reads from D1 + R2 via cloudflare:workers env
       └─→ public/PhotoMosaic / SatelliteMap mount as React islands on visible

officer
  └─→ Cloudflare Access (prod) → middleware sets ctx.locals.admin
       └─→ Admin page renders form → POST /admin/api/<entity>/save → seeOther()
            └─→ ImageUpload + MarkdownEditor islands handle their own fetches

photographer
  └─→ /p/<upload_token> (no auth, secret-URL-gated)
       └─→ Per-event page mounts PhotographerUploader + PhotographerPhotoManager
            └─→ Browser EXIF + canvas resize → POST /api/p/<token>/<eventId>/{upload,photos/*}
```

## When NOT to add a new dependency

- **No CSS framework swap.** Tailwind v4 is set up correctly; resist the urge to pull in shadcn, Radix, or a component library. We're shipping a small site, not a design system.
- **No ORM.** D1 queries are short, hand-rolled SQL in `queries.ts` / `mutations.ts`. Adding Drizzle/Kysely would increase the bundle and obscure what's happening.
- **No state management library.** React islands are tiny and self-contained.
- **No client-side router.** Astro server-renders every page; in-page interactivity is per-island. Don't introduce SPA navigation.

## When to update this file

After any change that surprises a reader of the source — a non-obvious workaround, a new convention, a renamed entity, a removed feature. Keep this concise; everything below 200 lines stays loaded automatically.

## Helpful skills

If you have the Cloudflare/Wrangler/Workers skills available, use them for anything platform-specific (binding names, deploy flags, R2/D1 commands) — they pull live docs and are more current than pre-trained knowledge.
