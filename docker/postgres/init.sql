-- Инициализация базы данных Votely
-- Миграции применяются в алфавитном порядке

-- 001_init.sql
CREATE TABLE IF NOT EXISTS polls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_text text NOT NULL,
    position int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS poll_votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_id uuid NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quizzes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text text NOT NULL,
    position int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_answers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id uuid NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    answer_text text NOT NULL,
    is_correct boolean NOT NULL DEFAULT false,
    position int NOT NULL DEFAULT 0
);

-- 002_poll_votes.sql
-- Уникальный индекс удалён - он мешал повторному голосованию

-- 003_poll_search_and_validation.sql
CREATE INDEX IF NOT EXISTS polls_title_idx ON polls(title);
CREATE INDEX IF NOT EXISTS polls_description_idx ON polls(description);

-- 004_vote_abuse_protection.sql
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS voter_token_hash text;
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS ip_hash text;
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS device_hash text;
-- Индексы перенесены в конец файла для правильного порядка применения

-- 005_traffic_attribution.sql
CREATE TABLE IF NOT EXISTS traffic_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type text NOT NULL,
    path text NOT NULL,
    method text NOT NULL,
    poll_id uuid REFERENCES polls(id) ON DELETE CASCADE,
    option_id uuid REFERENCES poll_options(id) ON DELETE CASCADE,
    voter_token_hash text,
    ip_hash text,
    device_hash text,
    user_agent text,
    referrer text,
    landing_url text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_term text,
    utm_content text,
    share_link_id uuid REFERENCES poll_share_links(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS traffic_events_poll_id_idx ON traffic_events(poll_id);
CREATE INDEX IF NOT EXISTS traffic_events_event_type_idx ON traffic_events(event_type);
CREATE INDEX IF NOT EXISTS traffic_events_share_link_created_at_idx ON traffic_events(share_link_id, created_at DESC);

-- 006_poll_controls_and_telegram_auth.sql
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

CREATE INDEX IF NOT EXISTS user_sessions_token_hash_idx ON user_sessions(token_hash);

ALTER TABLE polls
    ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS owner_key_hash text CHECK (owner_key_hash IS NULL OR char_length(owner_key_hash) = 64),
    ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS shuffle_options boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS allowed_countries text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS ends_at timestamptz,
    ADD COLUMN IF NOT EXISTS closed_at timestamptz,
    ADD COLUMN IF NOT EXISTS allow_multiple boolean NOT NULL DEFAULT false;

ALTER TABLE quizzes
    ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS owner_key_hash text CHECK (owner_key_hash IS NULL OR char_length(owner_key_hash) = 64),
    ADD COLUMN IF NOT EXISTS allowed_countries text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS ends_at timestamptz,
    ADD COLUMN IF NOT EXISTS closed_at timestamptz,
    ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    ADD COLUMN IF NOT EXISTS allow_multiple boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS polls_owner_user_id_idx ON polls(owner_user_id);
CREATE INDEX IF NOT EXISTS quizzes_owner_user_id_idx ON quizzes(owner_user_id);

-- 007_add_location_to_poll_votes.sql
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS ip_country text;
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS ip_region text;
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS ip_city text;

-- 008_add_ip_address_to_poll_votes.sql
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS utm_medium text;

CREATE TABLE IF NOT EXISTS poll_share_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    name text NOT NULL,
    slug text NOT NULL,
    utm_source text NOT NULL DEFAULT '',
    utm_medium text NOT NULL DEFAULT 'named',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (poll_id, slug)
);

CREATE TABLE IF NOT EXISTS quiz_share_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    name text NOT NULL,
    utm_source text NOT NULL DEFAULT '',
    utm_medium text NOT NULL DEFAULT 'shared',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS poll_share_links_poll_id_idx ON poll_share_links(poll_id);
CREATE INDEX IF NOT EXISTS quiz_share_links_quiz_id_idx ON quiz_share_links(quiz_id);

-- add_quiz_stats.sql
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_id uuid NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    answer_id uuid REFERENCES quiz_answers(id) ON DELETE SET NULL,
    user_agent text,
    ip_address text,
    ip_country text,
    utm_source text,
    utm_medium text,
    device_type text,
    os_type text,
    browser_type text,
    is_correct boolean NOT NULL DEFAULT false,
    share_link_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quiz_attempts_quiz_id_idx ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS quiz_attempts_question_id_idx ON quiz_attempts(question_id);

-- Дополнительные поля для poll_votes
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS telegram_user_id bigint REFERENCES telegram_users(id) ON DELETE SET NULL;
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS device_type text;
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS os_type text;
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS browser_type text;
ALTER TABLE poll_votes ADD COLUMN IF NOT EXISTS share_link_id uuid REFERENCES poll_share_links(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS poll_votes_share_link_id_idx ON poll_votes(share_link_id);

-- Уникальные индексы для защиты от повторного голосования
-- Индекс для telegram_user_id (один голос на пользователя на вариант)
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_telegram_user_option_unique
    ON poll_votes(poll_id, telegram_user_id, option_id)
    WHERE telegram_user_id IS NOT NULL;

-- Индекс для voter_token_hash
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_voter_token_hash_option_unique
    ON poll_votes(poll_id, voter_token_hash, option_id)
    WHERE voter_token_hash IS NOT NULL;

-- Индекс для ip_hash
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_ip_hash_option_unique
    ON poll_votes(poll_id, ip_hash, option_id)
    WHERE ip_hash IS NOT NULL;

-- Индекс для device_hash
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_device_hash_option_unique
    ON poll_votes(poll_id, device_hash, option_id)
    WHERE device_hash IS NOT NULL;

-- Индексы для quiz_attempts
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS telegram_user_id bigint REFERENCES telegram_users(id) ON DELETE SET NULL;
DROP INDEX IF EXISTS quiz_attempts_quiz_telegram_user_unique;
CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_quiz_telegram_answer_unique
    ON quiz_attempts(quiz_id, telegram_user_id, answer_id)
    WHERE telegram_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS quiz_attempts_telegram_user_id_idx ON quiz_attempts(telegram_user_id);
CREATE INDEX IF NOT EXISTS quizzes_visibility_created_at_idx ON quizzes(visibility, created_at DESC);
