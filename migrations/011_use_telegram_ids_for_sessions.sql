ALTER TABLE user_sessions DROP CONSTRAINT IF EXISTS user_sessions_user_uuid_fkey;
ALTER TABLE user_sessions DROP CONSTRAINT IF EXISTS user_sessions_user_id_fkey;
ALTER TABLE polls DROP CONSTRAINT IF EXISTS polls_owner_user_id_fkey;
ALTER TABLE polls DROP CONSTRAINT IF EXISTS polls_owner_user_uuid_fkey;
ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS quizzes_owner_user_id_fkey;
ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS quizzes_owner_user_uuid_fkey;

TRUNCATE TABLE user_sessions;

ALTER TABLE user_sessions
    ALTER COLUMN user_id TYPE bigint USING NULL;

ALTER TABLE polls
    ALTER COLUMN owner_user_id TYPE bigint USING NULL;

ALTER TABLE quizzes
    ALTER COLUMN owner_user_id TYPE bigint USING NULL;

ALTER TABLE user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES telegram_users(id) ON DELETE CASCADE;

ALTER TABLE polls
    ADD CONSTRAINT polls_owner_user_id_fkey
    FOREIGN KEY (owner_user_id) REFERENCES telegram_users(id) ON DELETE SET NULL;

ALTER TABLE quizzes
    ADD CONSTRAINT quizzes_owner_user_id_fkey
    FOREIGN KEY (owner_user_id) REFERENCES telegram_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions(user_id);
