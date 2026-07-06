ALTER TABLE polls
    ADD COLUMN IF NOT EXISTS owner_telegram_id bigint;

CREATE INDEX IF NOT EXISTS polls_owner_telegram_id_idx ON polls(owner_telegram_id);

-- Заполняем owner_telegram_id из существующих данных через users (для старых записей до миграции 011)
UPDATE polls p
SET owner_telegram_id = u.telegram_id
FROM users u
WHERE p.owner_user_id = u.id AND u.telegram_id IS NOT NULL;

-- Заполняем owner_telegram_id из owner_user_id (для записей после миграции 011, где owner_user_id уже хранит Telegram ID)
UPDATE polls
SET owner_telegram_id = owner_user_id
WHERE owner_telegram_id IS NULL AND owner_user_id IS NOT NULL;
