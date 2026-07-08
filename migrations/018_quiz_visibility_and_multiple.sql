-- Добавляем приватность и множественный выбор в викторины

ALTER TABLE quizzes
    ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
        CHECK (visibility IN ('public', 'private'));

ALTER TABLE quizzes
    ADD COLUMN IF NOT EXISTS allow_multiple boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS quizzes_visibility_created_at_idx ON quizzes(visibility, created_at DESC);
