-- Members now need a full mailing address (for renewals + chartering with
-- SCCA) and a single same-household family member can be included on a
-- membership at no extra cost. We add fields directly rather than a
-- separate household table — only one secondary member is supported.

PRAGMA foreign_keys = ON;

ALTER TABLE members ADD COLUMN address_line1 TEXT;
ALTER TABLE members ADD COLUMN address_line2 TEXT;
ALTER TABLE members ADD COLUMN state TEXT;
ALTER TABLE members ADD COLUMN postal_code TEXT;
ALTER TABLE members ADD COLUMN family_member_name TEXT;
