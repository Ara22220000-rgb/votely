-- Таблица для именованных ссылок викторин
CREATE TABLE IF NOT EXISTS quiz_share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    utm_source VARCHAR(100) DEFAULT 'custom',
    utm_medium VARCHAR(100) DEFAULT 'shared',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_share_links_quiz_id ON quiz_share_links(quiz_id);

-- Таблица для хранения попыток прохождения викторин
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    answer_id UUID REFERENCES quiz_answers(id) ON DELETE SET NULL,
    user_agent TEXT,
    ip_address INET,
    ip_country VARCHAR(2),
    device_type VARCHAR(20),
    os_type VARCHAR(30),
    browser_type VARCHAR(50),
    utm_source VARCHAR(100) DEFAULT '',
    utm_medium VARCHAR(100) DEFAULT 'shared',
    share_link_id UUID REFERENCES quiz_share_links(id) ON DELETE SET NULL,
    is_correct BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_question_id ON quiz_attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_created_at ON quiz_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_share_link_id ON quiz_attempts(share_link_id);
