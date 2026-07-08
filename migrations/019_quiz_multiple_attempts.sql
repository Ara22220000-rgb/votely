-- Меняем уникальный индекс для поддержки множественного выбора в викторинах
-- Старый индекс запрещал больше одной строки на (quiz_id, telegram_user_id)
-- Новый индекс запрещает выбирать один и тот же ответ дважды

DROP INDEX IF EXISTS quiz_attempts_quiz_telegram_user_unique;

CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_quiz_telegram_answer_unique
    ON quiz_attempts(quiz_id, telegram_user_id, answer_id)
    WHERE telegram_user_id IS NOT NULL;
