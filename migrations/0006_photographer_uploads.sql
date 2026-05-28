-- Replace Google Drive sync flow with per-photographer upload tokens.
--
-- D1-specific notes:
-- - `PRAGMA foreign_keys = OFF` doesn't persist across statements on D1's
--   remote API (each statement runs on its own connection), and
--   `defer_foreign_keys` can't defer `ON DELETE RESTRICT` checks (those are
--   immediate by spec). So we avoid dropping any parent table.
-- - photographers + event_photographers are modified in place with
--   `ALTER TABLE ADD/DROP COLUMN`.
-- - photos is rebuilt (drive_file_id is UNIQUE-indexed, and DROP COLUMN
--   can't drop indexed columns) — safe because nothing references photos.
--
-- upload_token is added as nullable here and backfilled; uniqueness is
-- enforced via a unique index. NOT NULL is enforced at the app layer
-- (generateUploadToken always supplies a value on insert).

-- ---------------------------------------------------------------------------
-- photographers: add upload_token (no rebuild)
-- ---------------------------------------------------------------------------

ALTER TABLE photographers ADD COLUMN upload_token TEXT;
UPDATE photographers SET upload_token = lower(hex(randomblob(16))) WHERE upload_token IS NULL;
CREATE UNIQUE INDEX idx_photographers_upload_token ON photographers(upload_token);

-- ---------------------------------------------------------------------------
-- event_photographers: drop drive_folder_url (no rebuild)
-- ---------------------------------------------------------------------------

ALTER TABLE event_photographers DROP COLUMN drive_folder_url;

-- ---------------------------------------------------------------------------
-- photos: rebuild (drive_file_id is UNIQUE-indexed, so DROP COLUMN can't
-- touch it directly). Safe rebuild — no other table references photos, so
-- the DROP TABLE doesn't trip any incoming FK check.
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
-- drive_sync_state: no FK relationships, plain drop.
-- ---------------------------------------------------------------------------

DROP TABLE drive_sync_state;
