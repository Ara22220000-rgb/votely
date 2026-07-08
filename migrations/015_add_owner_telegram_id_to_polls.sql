ALTER TABLE polls
    ADD COLUMN IF NOT EXISTS owner_telegram_id bigint;

CREATE INDEX IF NOT EXISTS polls_owner_telegram_id_idx ON polls(owner_telegram_id);

-- Заполняем owner_telegram_id из existing данных через users (для старых записей до миграции 011)
UPDATE polls p
SET owner_telegram_id = u.telegram_id
FROM users u
WHERE p.owner_user_id = u.id AND u.telegram_id IS NOT NULL;

-- Заполняем owner_telegram_id из owner_user_id (для записей после миграции 011)
-- owner_user_id может содержать UUID или bigint (Telegram ID), нужно приведение
UPDATE polls
SET owner_telegram_id = (
    SELECT u.telegram_id 
    FROM users u 
    WHERE u.id::text = polls.owner_user_id::text
)
WHERE owner_telegram_id IS NULL 
  AND owner_user_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM users u WHERE u.id::text = polls.owner_user_id::text);
