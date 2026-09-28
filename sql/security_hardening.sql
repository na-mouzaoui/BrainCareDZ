-- Security hardening: token revocation
-- Apply on the live BrainCare database. Idempotent.

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
