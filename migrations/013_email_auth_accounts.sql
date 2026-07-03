CREATE TABLE IF NOT EXISTS email_users (
    email text PRIMARY KEY,
    telegram_user_id bigint NOT NULL UNIQUE REFERENCES telegram_users(id) ON DELETE CASCADE,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS email_user_id_seq START WITH 1;
