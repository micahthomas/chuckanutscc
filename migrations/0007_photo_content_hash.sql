-- Per-photo content hash for dedupe. Set on every new upload; null for
-- legacy / Wix-imported photos (no hash on file). Scoped by (photographer,
-- event) so the same shot in two different events both count as live.

ALTER TABLE photos ADD COLUMN content_hash TEXT;

CREATE INDEX idx_photos_dedup ON photos(photographer_id, event_id, content_hash);
