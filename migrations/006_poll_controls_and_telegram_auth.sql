CREATE TABLE telegram_users (
    id bigint PRIMARY KEY,
    first_name text NOT NULL DEFAULT '',
    last_name text NOT NULL DEFAULT '',
    username text NOT NULL DEFAULT '',
    photo_url text NOT NULL DEFAULT '',
    auth_date timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id bigint NOT NULL REFERENCES telegram_users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE CHECK (char_length(token_hash) = 64),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE polls
    ADD COLUMN owner_user_id bigint REFERENCES telegram_users(id) ON DELETE SET NULL,
    ADD COLUMN owner_key_hash text CHECK (owner_key_hash IS NULL OR char_length(owner_key_hash) = 64),
    ADD COLUMN is_anonymous boolean NOT NULL DEFAULT false,
    ADD COLUMN shuffle_options boolean NOT NULL DEFAULT false,
    ADD COLUMN allowed_countries text[] NOT NULL DEFAULT '{}',
    ADD COLUMN ends_at timestamptz,
    ADD COLUMN closed_at timestamptz;

ALTER TABLE quizzes
    ADD COLUMN owner_user_id bigint REFERENCES telegram_users(id) ON DELETE SET NULL,
    ADD COLUMN owner_key_hash text CHECK (owner_key_hash IS NULL OR char_length(owner_key_hash) = 64),
    ADD COLUMN allowed_countries text[] NOT NULL DEFAULT '{}',
    ADD COLUMN ends_at timestamptz,
    ADD COLUMN closed_at timestamptz;

CREATE INDEX polls_owner_user_id_idx ON polls(owner_user_id);
CREATE INDEX quizzes_owner_user_id_idx ON quizzes(owner_user_id);
CREATE INDEX user_sessions_token_hash_idx ON user_sessions(token_hash);
