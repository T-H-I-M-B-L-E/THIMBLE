-- Split account verification (email confirmation, set at signup) from
-- profile verification (gold badge, granted by admin after ID review).
--
-- Before this migration, `verification_status` was overloaded for both.
-- After this migration:
--   - is_verified BOOLEAN: profile/badge verification (admin-granted only)
--   - verification_status remains for account/email state ('unverified' | 'verified')

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Carry over any users who were previously marked 'verified' under the old
-- overloaded column. They keep their badge.
UPDATE users SET is_verified = TRUE WHERE verification_status = 'verified' AND is_verified = FALSE;

-- Reset verification_status semantics: account is verified if the user has
-- successfully completed signup (we treat existing rows as account-verified
-- since they're past the email-code gate).
UPDATE users SET verification_status = 'verified' WHERE verification_status IN ('verified', 'pending');
-- 'unverified' rows stay 'unverified' (incomplete signup).

CREATE INDEX IF NOT EXISTS idx_users_is_verified ON users(is_verified) WHERE is_verified = TRUE;
