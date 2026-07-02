CREATE TABLE IF NOT EXISTS telegram_users (
    id bigint PRIMARY KEY,
    first_name text NOT NULL DEFAULT '',
    last_name text NOT NULL DEFAULT '',
    username text NOT NULL DEFAULT '',
    photo_url text NOT NULL DEFAULT '',
    auth_date timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id bigint UNIQUE REFERENCES telegram_users(id) ON DELETE SET NULL,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_telegram_id_idx ON users(telegram_id);

CREATE TABLE IF NOT EXISTS user_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE CHECK (char_length(token_hash) = 64),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE polls
    ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS owner_key_hash text CHECK (owner_key_hash IS NULL OR char_length(owner_key_hash) = 64),
    ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS shuffle_options boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS allowed_countries text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS ends_at timestamptz,
    ADD COLUMN IF NOT EXISTS closed_at timestamptz;

ALTER TABLE quizzes
    ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS owner_key_hash text CHECK (owner_key_hash IS NULL OR char_length(owner_key_hash) = 64),
    ADD COLUMN IF NOT EXISTS allowed_countries text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS ends_at timestamptz,
    ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE INDEX IF NOT EXISTS polls_owner_user_id_idx ON polls(owner_user_id);
CREATE INDEX IF NOT EXISTS quizzes_owner_user_id_idx ON quizzes(owner_user_id);
CREATE INDEX IF NOT EXISTS user_sessions_token_hash_idx ON user_sessions(token_hash);
