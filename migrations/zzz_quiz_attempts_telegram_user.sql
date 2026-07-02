CREATE TABLE IF NOT EXISTS quiz_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_id uuid NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    answer_id uuid REFERENCES quiz_answers(id) ON DELETE SET NULL,
    telegram_user_id bigint REFERENCES telegram_users(id) ON DELETE SET NULL,
    user_agent text,
    ip_address inet,
    ip_country varchar(2),
    device_type varchar(20),
    os_type varchar(30),
    browser_type varchar(50),
    utm_source varchar(100) DEFAULT '',
    utm_medium varchar(100) DEFAULT 'shared',
    share_link_id uuid,
    is_correct boolean,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quiz_attempts
    ADD COLUMN IF NOT EXISTS telegram_user_id bigint REFERENCES telegram_users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_quiz_telegram_user_unique
    ON quiz_attempts(quiz_id, telegram_user_id)
    WHERE telegram_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS quiz_attempts_telegram_user_id_idx ON quiz_attempts(telegram_user_id);
