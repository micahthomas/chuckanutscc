-- Standardize the content-page chrome. Until now /autocross, /membership, and
-- /[slug] each rendered their own hero markup, and the autocross rules lived
-- in a hard-coded one-off file. This migration moves the hero copy + toggles
-- onto the pages row itself so every editorial page renders through the
-- shared CmsPage component.
--
-- All columns are nullable / default to '' so existing rows keep working —
-- they just render with no eyebrow, no checklist, no CTAs (i.e. the current
-- basic `[slug].astro` chrome).

PRAGMA foreign_keys = ON;

ALTER TABLE pages ADD COLUMN eyebrow         TEXT NOT NULL DEFAULT '';
ALTER TABLE pages ADD COLUMN subtitle        TEXT NOT NULL DEFAULT '';
ALTER TABLE pages ADD COLUMN hero_image_key  TEXT;
ALTER TABLE pages ADD COLUMN hero_stat_value TEXT NOT NULL DEFAULT '';
ALTER TABLE pages ADD COLUMN hero_stat_label TEXT NOT NULL DEFAULT '';
-- JSON array of strings, e.g. ["Any car welcome","Loaner helmets",...]
ALTER TABLE pages ADD COLUMN hero_items_json TEXT NOT NULL DEFAULT '[]';
-- JSON array of { label, href, primary? }, e.g.
-- [{"label":"Come to your first event","href":"/events","primary":true},...]
ALTER TABLE pages ADD COLUMN hero_ctas_json  TEXT NOT NULL DEFAULT '[]';
-- Render a sticky TOC built from H2 headings in body_md.
ALTER TABLE pages ADD COLUMN show_toc        INTEGER NOT NULL DEFAULT 0;
-- Show a "Print or save as PDF" button + ship a print stylesheet.
ALTER TABLE pages ADD COLUMN show_print      INTEGER NOT NULL DEFAULT 0;
