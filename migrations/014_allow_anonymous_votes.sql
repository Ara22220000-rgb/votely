-- Миграция для разрешения голосования без Telegram
-- Добавляем уникальные индексы для voter_token_hash, ip_hash, device_hash
-- с правильными именами ограничений для использования в ON CONFLICT

-- Создаём уникальные индексы с именами ограничений
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_voter_token_unique
    ON poll_votes(poll_id, voter_token_hash)
    WHERE voter_token_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_ip_unique
    ON poll_votes(poll_id, ip_hash)
    WHERE ip_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_device_unique
    ON poll_votes(poll_id, device_hash)
    WHERE device_hash IS NOT NULL;

-- Добавляем проверку на длину voter_token_hash
ALTER TABLE poll_votes
    ADD CONSTRAINT IF NOT EXISTS poll_votes_voter_token_hash_length_check 
    CHECK (voter_token_hash IS NULL OR char_length(voter_token_hash) = 64);
