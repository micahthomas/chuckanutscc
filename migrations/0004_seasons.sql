-- Group events by a "season" (typically one per calendar year) so the
-- public /events page can show just the current season by default and the
-- club can keep a navigable archive of every previous year.

PRAGMA foreign_keys = ON;

CREATE TABLE seasons (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  -- Display year ("2026") — separate from name so officers can override
  -- (e.g. "2027 Winter Series").
  year        INTEGER NOT NULL,
  name        TEXT NOT NULL,
  description_md TEXT NOT NULL DEFAULT '',
  -- Exactly one row should have is_current = 1; enforced by an admin check
  -- in the save handler, not by the schema (multiple = harmless, just picks
  -- the most-recent year).
  is_current  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_seasons_year ON seasons(year);

ALTER TABLE events ADD COLUMN season_id TEXT REFERENCES seasons(id) ON DELETE SET NULL;
CREATE INDEX idx_events_season ON events(season_id);
