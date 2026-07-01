CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE polls
    ADD CONSTRAINT polls_title_length_check CHECK (char_length(trim(title)) BETWEEN 1 AND 160),
    ADD CONSTRAINT polls_description_length_check CHECK (char_length(description) <= 2000);

ALTER TABLE poll_options
    ADD CONSTRAINT poll_options_text_length_check CHECK (char_length(trim(option_text)) BETWEEN 1 AND 300);

ALTER TABLE quizzes
    ADD CONSTRAINT quizzes_title_length_check CHECK (char_length(trim(title)) BETWEEN 1 AND 160),
    ADD CONSTRAINT quizzes_description_length_check CHECK (char_length(description) <= 2000);

ALTER TABLE quiz_questions
    ADD CONSTRAINT quiz_questions_text_length_check CHECK (char_length(trim(question_text)) BETWEEN 1 AND 500);

ALTER TABLE quiz_answers
    ADD CONSTRAINT quiz_answers_text_length_check CHECK (char_length(trim(answer_text)) BETWEEN 1 AND 300);

CREATE INDEX polls_title_trgm_idx ON polls USING gin (title gin_trgm_ops);
CREATE INDEX polls_description_trgm_idx ON polls USING gin (description gin_trgm_ops);
