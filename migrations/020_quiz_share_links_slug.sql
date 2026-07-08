-- Add slug column to quiz_share_links (matching poll_share_links structure)
ALTER TABLE quiz_share_links ADD COLUMN IF NOT EXISTS slug text NOT NULL DEFAULT '';

-- Backfill slug from name for existing rows
UPDATE quiz_share_links SET slug = name WHERE slug = '' OR slug IS NULL;

-- Add unique constraint on (quiz_id, slug)
CREATE UNIQUE INDEX IF NOT EXISTS quiz_share_links_quiz_slug_idx ON quiz_share_links(quiz_id, slug);
