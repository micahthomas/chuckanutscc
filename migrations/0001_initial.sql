-- CSCC website initial schema.
-- Timestamps are Unix seconds (INTEGER). Rich text is Markdown source.
-- Image references are JSON arrays of { r2_key, alt, caption }.

PRAGMA foreign_keys = ON;

-- ============================================================================
-- Content
-- ============================================================================

CREATE TABLE pages (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  body_md         TEXT NOT NULL DEFAULT '',
  show_in_nav     INTEGER NOT NULL DEFAULT 0,
  nav_order       INTEGER NOT NULL DEFAULT 0,
  seo_title       TEXT,
  seo_description TEXT,
  seo_image_key   TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  updated_by      TEXT
);
CREATE INDEX idx_pages_nav ON pages(show_in_nav, nav_order);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ============================================================================
-- Events + photographers
-- ============================================================================

CREATE TABLE events (
  id                  TEXT PRIMARY KEY,
  slug                TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  event_type          TEXT NOT NULL,             -- autocross | social | meeting | tour | other
  status              TEXT NOT NULL DEFAULT 'scheduled',
  start_at            INTEGER NOT NULL,
  end_at              INTEGER,
  location_name       TEXT,
  location_address    TEXT,
  location_map_url    TEXT,
  description_md      TEXT NOT NULL DEFAULT '',
  hero_image_key      TEXT,
  registration_url    TEXT,
  results_url         TEXT,
  run_groups_json     TEXT,
  fee_member_cents    INTEGER,
  fee_nonmember_cents INTEGER,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  updated_by          TEXT
);
CREATE INDEX idx_events_start_status ON events(status, start_at);

CREATE TABLE photographers (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  bio_md          TEXT,
  headshot_key    TEXT,
  portfolio_url   TEXT,
  instagram_url   TEXT,
  contact_email   TEXT,                          -- not rendered publicly
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE event_photographers (
  id                TEXT PRIMARY KEY,
  event_id          TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  photographer_id   TEXT NOT NULL REFERENCES photographers(id) ON DELETE RESTRICT,
  drive_folder_url  TEXT NOT NULL,
  notes             TEXT,
  created_at        INTEGER NOT NULL,
  UNIQUE(event_id, photographer_id)
);
CREATE INDEX idx_ep_event ON event_photographers(event_id);
CREATE INDEX idx_ep_photog ON event_photographers(photographer_id);

-- ============================================================================
-- Homepage (singleton)
-- ============================================================================

CREATE TABLE home_page (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  hero_title          TEXT,
  hero_subtitle       TEXT,
  hero_image_key      TEXT,
  hero_cta_text       TEXT,
  hero_cta_url        TEXT,
  featured_event_mode TEXT NOT NULL DEFAULT 'auto-next',  -- auto-next | manual
  pinned_event_id     TEXT REFERENCES events(id) ON DELETE SET NULL,
  sections_json       TEXT NOT NULL DEFAULT '[]',
  updated_at          INTEGER NOT NULL,
  updated_by          TEXT
);

-- ============================================================================
-- Photos (synced from Google Drive)
-- ============================================================================

CREATE TABLE photos (
  id                  TEXT PRIMARY KEY,
  event_id            TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  photographer_id     TEXT NOT NULL REFERENCES photographers(id) ON DELETE RESTRICT,
  drive_file_id       TEXT NOT NULL UNIQUE,
  drive_folder_url    TEXT NOT NULL,
  filename            TEXT NOT NULL,
  exif_taken_at       INTEGER,
  drive_uploaded_at   INTEGER NOT NULL,
  width               INTEGER,
  height              INTEGER,
  r2_key_thumb        TEXT NOT NULL,
  r2_key_display      TEXT NOT NULL,
  r2_key_full         TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'live',  -- live | hidden | rejected
  synced_at           INTEGER NOT NULL,
  hidden_at           INTEGER,
  hidden_by           TEXT
);
CREATE INDEX idx_photos_event_status ON photos(event_id, status, exif_taken_at);

CREATE TABLE drive_sync_state (
  drive_folder_url    TEXT PRIMARY KEY,
  last_synced_at      INTEGER,
  last_page_token     TEXT,
  last_error          TEXT,
  last_error_at       INTEGER
);

-- ============================================================================
-- Membership
-- ============================================================================

CREATE TABLE membership_tiers (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  description_md      TEXT,
  annual_price_cents  INTEGER NOT NULL,
  benefits_json       TEXT NOT NULL DEFAULT '[]',
  sort_order          INTEGER NOT NULL DEFAULT 0,
  visible             INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE members (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  phone               TEXT,
  city                TEXT,
  car_info            TEXT,
  tier_id             TEXT REFERENCES membership_tiers(id),
  joined_at           INTEGER NOT NULL,
  expires_at          INTEGER,                   -- Dec 31 23:59 of latest paid year
  newsletter_opt_in   INTEGER NOT NULL DEFAULT 1,
  notes               TEXT,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX idx_members_expires ON members(expires_at);
CREATE INDEX idx_members_email ON members(email);

CREATE TABLE member_payments (
  id                          TEXT PRIMARY KEY,
  member_id                   TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  tier_id                     TEXT NOT NULL REFERENCES membership_tiers(id),
  amount_cents                INTEGER NOT NULL,
  membership_year             INTEGER NOT NULL,
  stripe_checkout_session_id  TEXT UNIQUE,
  stripe_payment_intent_id    TEXT,
  paid_at                     INTEGER NOT NULL,
  raw_stripe_event_json       TEXT
);
CREATE INDEX idx_payments_year ON member_payments(membership_year);

-- ============================================================================
-- Merch (request-only, no Stripe in v1)
-- ============================================================================

CREATE TABLE merch_items (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  description_md  TEXT NOT NULL DEFAULT '',
  images_json     TEXT NOT NULL DEFAULT '[]',
  options_json    TEXT NOT NULL DEFAULT '[]',    -- [{name:"Size", choices:["S","M","L"]}]
  available       INTEGER NOT NULL DEFAULT 1,
  notes           TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE merch_requests (
  id              TEXT PRIMARY KEY,
  item_id         TEXT NOT NULL REFERENCES merch_items(id) ON DELETE RESTRICT,
  requester_name  TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  selections_json TEXT NOT NULL DEFAULT '{}',
  quantity        INTEGER NOT NULL DEFAULT 1,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'open',  -- open | in_next_order | fulfilled | cancelled
  admin_notes     TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX idx_merch_requests_status ON merch_requests(status, created_at);

-- ============================================================================
-- Newsletter + transactional email
-- ============================================================================

CREATE TABLE newsletter_subscribers (
  id                TEXT PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE,
  name              TEXT,
  source            TEXT,                        -- membership | footer-form | imported
  subscribed_at     INTEGER NOT NULL,
  unsubscribed_at   INTEGER,
  unsubscribe_token TEXT NOT NULL UNIQUE
);
CREATE INDEX idx_subs_active ON newsletter_subscribers(unsubscribed_at);

CREATE TABLE event_reminders (
  id              TEXT PRIMARY KEY,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reminder_type   TEXT NOT NULL,                 -- one_month | one_week
  scheduled_for   INTEGER NOT NULL,
  sent_at         INTEGER,
  recipient_count INTEGER,
  UNIQUE(event_id, reminder_type)
);
CREATE INDEX idx_reminders_pending ON event_reminders(sent_at, scheduled_for);

CREATE TABLE email_log (
  id              TEXT PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  subject         TEXT NOT NULL,
  template        TEXT NOT NULL,
  related_id      TEXT,
  resend_id       TEXT,
  status          TEXT NOT NULL,                 -- sent | failed | bounced
  sent_at         INTEGER NOT NULL,
  error           TEXT
);
CREATE INDEX idx_email_log_recipient ON email_log(recipient_email, sent_at);

-- ============================================================================
-- Contact form
-- ============================================================================

CREATE TABLE contact_submissions (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  subject     TEXT,
  message     TEXT NOT NULL,
  topic       TEXT,                              -- general | membership | events | other
  status      TEXT NOT NULL DEFAULT 'new',       -- new | responded | archived
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_contact_status ON contact_submissions(status, created_at);

-- ============================================================================
-- Seed: singleton rows + default membership tiers
-- ============================================================================

INSERT INTO home_page (id, updated_at) VALUES (1, unixepoch());

INSERT INTO membership_tiers (id, name, annual_price_cents, sort_order) VALUES
  ('individual', 'Individual', 5000, 1),
  ('family',     'Family',     7500, 2);

INSERT INTO settings (key, value) VALUES
  ('club_name',     'Chuckanut Sports Car Club'),
  ('tagline',       'Promoting the love of motorsports in the beautiful Pacific Northwest since 1956'),
  ('contact_email', 'info@chuckanutscc.org');
