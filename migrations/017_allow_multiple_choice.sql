-- Добавляем поддержку множественного выбора в опросах

-- 1. Добавляем флаг allow_multiple в таблицу polls
ALTER TABLE polls
    ADD COLUMN IF NOT EXISTS allow_multiple boolean NOT NULL DEFAULT false;

-- 2. Меняем уникальные индексы в poll_votes
-- Удаляем старые индексы (один голос на пользователя на опрос)
DROP INDEX IF EXISTS poll_votes_poll_telegram_user_unique;
DROP INDEX IF EXISTS poll_votes_poll_voter_token_hash_unique;
DROP INDEX IF EXISTS poll_votes_poll_ip_hash_unique;
DROP INDEX IF EXISTS poll_votes_poll_device_hash_unique;

-- Создаём новые индексы (один голос на пользователя на опрос на вариант)
-- Это позволяет выбирать несколько вариантов в одном опросе
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_telegram_user_option_unique
    ON poll_votes(poll_id, telegram_user_id, option_id)
    WHERE telegram_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_voter_token_hash_option_unique
    ON poll_votes(poll_id, voter_token_hash, option_id)
    WHERE voter_token_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_ip_hash_option_unique
    ON poll_votes(poll_id, ip_hash, option_id)
    WHERE ip_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_device_hash_option_unique
    ON poll_votes(poll_id, device_hash, option_id)
    WHERE device_hash IS NOT NULL;

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS poll_votes_poll_option_idx ON poll_votes(poll_id, option_id);
