-- Миграция для исправления индексов голосования
-- Удаляем дублирующие индексы из предыдущих миграций и создаём правильные

-- Удаляем старые индексы, если они существуют (из 004 и 014 миграций)
DROP INDEX IF EXISTS poll_votes_poll_voter_token_hash_unique;
DROP INDEX IF EXISTS poll_votes_poll_ip_hash_unique;
DROP INDEX IF EXISTS poll_votes_poll_device_hash_unique;
DROP INDEX IF EXISTS poll_votes_poll_voter_token_unique;
DROP INDEX IF EXISTS poll_votes_poll_ip_unique;
DROP INDEX IF EXISTS poll_votes_poll_device_unique;
DROP INDEX IF EXISTS poll_votes_voter_unique;
DROP INDEX IF EXISTS poll_votes_device_unique;

-- Создаём уникальные индексы с правильными именами для использования в ON CONFLICT
-- Индекс для voter_token_hash
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_voter_token_hash_unique
    ON poll_votes(poll_id, voter_token_hash)
    WHERE voter_token_hash IS NOT NULL;

-- Индекс для ip_hash
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_ip_hash_unique
    ON poll_votes(poll_id, ip_hash)
    WHERE ip_hash IS NOT NULL;

-- Индекс для device_hash
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_device_hash_unique
    ON poll_votes(poll_id, device_hash)
    WHERE device_hash IS NOT NULL;

-- Индекс для telegram_user_id (из миграции 009, создаём если не существует)
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_telegram_user_unique
    ON poll_votes(poll_id, telegram_user_id)
    WHERE telegram_user_id IS NOT NULL;

-- Индекс для поиска по telegram_user_id
CREATE INDEX IF NOT EXISTS poll_votes_telegram_user_id_idx ON poll_votes(telegram_user_id);
