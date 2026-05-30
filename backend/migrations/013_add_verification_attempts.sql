-- Track how many times each pending verification code has been guessed.
-- Lets us lock out a code after N failed attempts to prevent brute force.
ALTER TABLE email_verification_codes
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_email_verification_codes_email_created
  ON email_verification_codes (email, created_at DESC);
