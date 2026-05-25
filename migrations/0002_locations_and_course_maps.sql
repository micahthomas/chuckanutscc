-- Add a real venues entity (one row per place we run events) and per-event
-- course map images.

PRAGMA foreign_keys = ON;

-- ============================================================================
-- Locations
-- ============================================================================

CREATE TABLE locations (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  address         TEXT,
  -- Decimal lat/lng. We don't enforce ranges in SQLite — the admin form
  -- validates. NULL means "no map preview".
  latitude        REAL,
  longitude       REAL,
  -- Optional R2 key for an uploaded map screenshot. When NULL the public
  -- venue page falls back to an OpenStreetMap iframe centered on lat/lng.
  map_image_key   TEXT,
  description_md  TEXT NOT NULL DEFAULT '',
  directions_md   TEXT NOT NULL DEFAULT '',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX idx_locations_active_sort ON locations(active, sort_order);

-- ============================================================================
-- Events: add FK to locations + per-event course map
-- ============================================================================

ALTER TABLE events ADD COLUMN location_id TEXT REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN course_map_image_key TEXT;

CREATE INDEX idx_events_location ON events(location_id);
