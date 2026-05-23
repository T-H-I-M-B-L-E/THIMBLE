-- Add user-editable @username with a 30-day cooldown.
-- Backfills from the email local-part for existing users.

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ;

-- Backfill: use the email local-part, lowercased, with non-allowed chars
-- stripped. Disambiguate collisions by appending a short suffix derived
-- from the user id.
UPDATE users
SET username = base.candidate
FROM (
    SELECT u.id,
           lower(regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9_\.]', '', 'g'))
             || CASE
                  WHEN EXISTS (
                      SELECT 1 FROM users u2
                      WHERE u2.id <> u.id
                        AND lower(regexp_replace(split_part(u2.email, '@', 1), '[^a-z0-9_\.]', '', 'g'))
                            = lower(regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9_\.]', '', 'g'))
                  )
                  THEN substr(replace(u.id::text, '-', ''), 1, 4)
                  ELSE ''
                END AS candidate
    FROM users u
    WHERE u.username IS NULL OR u.username = ''
) AS base
WHERE users.id = base.id;

-- Anything we couldn't derive: fall back to a short id-based handle.
UPDATE users
SET username = 'user_' || substr(replace(id::text, '-', ''), 1, 8)
WHERE username IS NULL OR username = '';

-- Enforce uniqueness (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_lower ON users (lower(username));

-- Make username NOT NULL going forward.
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
