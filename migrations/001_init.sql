CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS polls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL CHECK (length(trim(title)) > 0),
    description text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_text text NOT NULL CHECK (length(trim(option_text)) > 0),
    position integer NOT NULL CHECK (position > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (poll_id, position)
);

CREATE TABLE IF NOT EXISTS quizzes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL CHECK (length(trim(title)) > 0),
    description text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text text NOT NULL CHECK (length(trim(question_text)) > 0),
    position integer NOT NULL CHECK (position > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (quiz_id, position)
);

CREATE TABLE IF NOT EXISTS quiz_answers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id uuid NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    answer_text text NOT NULL CHECK (length(trim(answer_text)) > 0),
    is_correct boolean NOT NULL DEFAULT false,
    position integer NOT NULL CHECK (position > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (question_id, position)
);

CREATE INDEX IF NOT EXISTS poll_options_poll_id_idx ON poll_options(poll_id);
CREATE INDEX IF NOT EXISTS quiz_questions_quiz_id_idx ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS quiz_answers_question_id_idx ON quiz_answers(question_id);
