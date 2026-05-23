-- Verification requests: users apply, admins review

CREATE TABLE IF NOT EXISTS verification_requests (
    id              BIGSERIAL PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    full_name       TEXT NOT NULL,
    email           TEXT NOT NULL,
    id_document_url TEXT NOT NULL,
    reason          TEXT NOT NULL,
    admin_note      TEXT,
    reviewed_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id ON verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status  ON verification_requests(status, created_at DESC);

-- Only one pending request per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_verification_requests_one_pending_per_user
    ON verification_requests(user_id)
    WHERE status = 'pending';
