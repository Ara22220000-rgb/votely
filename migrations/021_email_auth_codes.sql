-- Email authentication: add columns to telegram_users for email-based users
ALTER TABLE telegram_users
    ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS auth_method text NOT NULL DEFAULT 'telegram';

CREATE INDEX IF NOT EXISTS telegram_users_email_idx ON telegram_users(email) WHERE email <> '';

-- Sequence for generating IDs for email-based users (starts high to avoid Telegram ID collisions)
CREATE SEQUENCE IF NOT EXISTS email_user_id_seq START WITH 9000000000001;

-- Temporary table for email verification codes
CREATE TABLE IF NOT EXISTS email_auth_codes (
    email text NOT NULL,
    code_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    attempts int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_auth_codes_email_idx ON email_auth_codes(email);
CREATE INDEX IF NOT EXISTS email_auth_codes_expires_idx ON email_auth_codes(expires_at);
