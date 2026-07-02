ALTER TABLE poll_votes
    ADD COLUMN IF NOT EXISTS telegram_user_id bigint REFERENCES telegram_users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_telegram_user_unique
    ON poll_votes(poll_id, telegram_user_id)
    WHERE telegram_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS poll_votes_telegram_user_id_idx ON poll_votes(telegram_user_id);
