-- Replace Google Drive sync flow with per-photographer upload tokens.
--
-- - Adds `upload_token` (UNIQUE) to photographers; backfilled with hex(randomblob(16))
--   so every existing row gets a fresh URL on apply.
-- - Drops Drive folder URLs from event_photographers (assignment becomes
--   photographer + notes only).
-- - Drops drive_file_id / drive_folder_url / drive_uploaded_at from photos;
--   renames drive_uploaded_at -> uploaded_at; drops the now-meaningless
--   synced_at column. Adds sort_order for photographer-controlled ordering.
-- - Drops drive_sync_state entirely.
--
-- Wix-imported photos survive because we INSERT ... SELECT them into the new
-- shape with their EXIF, dimensions, R2 keys and status preserved.

PRAGMA foreign_keys = OFF;

-- ---------------------------------------------------------------------------
-- photographers: add upload_token
-- ---------------------------------------------------------------------------

CREATE TABLE photographers_new (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  bio_md          TEXT,
  headshot_key    TEXT,
  portfolio_url   TEXT,
  instagram_url   TEXT,
  contact_email   TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  upload_token    TEXT NOT NULL UNIQUE,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

INSERT INTO photographers_new
  (id, slug, name, bio_md, headshot_key, portfolio_url, instagram_url,
   contact_email, active, upload_token, created_at, updated_at)
SELECT id, slug, name, bio_md, headshot_key, portfolio_url, instagram_url,
       contact_email, active,
       lower(hex(randomblob(16))),
       created_at, updated_at
FROM photographers;

DROP TABLE photographers;
ALTER TABLE photographers_new RENAME TO photographers;

-- ---------------------------------------------------------------------------
-- event_photographers: drop drive_folder_url
-- ---------------------------------------------------------------------------

CREATE TABLE event_photographers_new (
  id                TEXT PRIMARY KEY,
  event_id          TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  photographer_id   TEXT NOT NULL REFERENCES photographers(id) ON DELETE RESTRICT,
  notes             TEXT,
  created_at        INTEGER NOT NULL,
  UNIQUE(event_id, photographer_id)
);

INSERT INTO event_photographers_new (id, event_id, photographer_id, notes, created_at)
SELECT id, event_id, photographer_id, notes, created_at FROM event_photographers;

DROP TABLE event_photographers;
ALTER TABLE event_photographers_new RENAME TO event_photographers;
CREATE INDEX idx_ep_event ON event_photographers(event_id);
CREATE INDEX idx_ep_photog ON event_photographers(photographer_id);

-- ---------------------------------------------------------------------------
-- photos: drop drive_*, rename drive_uploaded_at -> uploaded_at,
-- drop synced_at, add sort_order.
-- ---------------------------------------------------------------------------

CREATE TABLE photos_new (
  id                  TEXT PRIMARY KEY,
  event_id            TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  photographer_id     TEXT NOT NULL REFERENCES photographers(id) ON DELETE RESTRICT,
  filename            TEXT NOT NULL,
  exif_taken_at       INTEGER,
  uploaded_at         INTEGER NOT NULL,
  width               INTEGER,
  height              INTEGER,
  r2_key_thumb        TEXT NOT NULL,
  r2_key_display      TEXT NOT NULL,
  r2_key_full         TEXT NOT NULL,
  sort_order          INTEGER,
  status              TEXT NOT NULL DEFAULT 'live',
  hidden_at           INTEGER,
  hidden_by           TEXT
);

INSERT INTO photos_new
  (id, event_id, photographer_id, filename, exif_taken_at, uploaded_at,
   width, height, r2_key_thumb, r2_key_display, r2_key_full,
   sort_order, status, hidden_at, hidden_by)
SELECT id, event_id, photographer_id, filename, exif_taken_at, drive_uploaded_at,
       width, height, r2_key_thumb, r2_key_display, r2_key_full,
       NULL, status, hidden_at, hidden_by
FROM photos;

DROP TABLE photos;
ALTER TABLE photos_new RENAME TO photos;
CREATE INDEX idx_photos_event_status ON photos(event_id, status, sort_order, exif_taken_at);
CREATE INDEX idx_photos_photog ON photos(photographer_id, event_id);

-- ---------------------------------------------------------------------------
-- drive_sync_state: gone
-- ---------------------------------------------------------------------------

DROP TABLE drive_sync_state;

PRAGMA foreign_keys = ON;
