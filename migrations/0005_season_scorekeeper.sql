-- Each season can have its own Scorekeeper series so the admin event-form
-- dropdown pulls the right year's events. Falls back to the global setting
-- when blank.

ALTER TABLE seasons ADD COLUMN scorekeeper_series TEXT;
