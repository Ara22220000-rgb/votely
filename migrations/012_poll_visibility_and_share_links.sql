ALTER TABLE polls
    ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
        CHECK (visibility IN ('public', 'private'));

CREATE TABLE IF NOT EXISTS poll_share_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    name text NOT NULL,
    slug text NOT NULL,
    utm_source text NOT NULL DEFAULT '',
    utm_medium text NOT NULL DEFAULT 'named',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (poll_id, slug)
);

ALTER TABLE poll_share_links
    ADD COLUMN IF NOT EXISTS slug text,
    ADD COLUMN IF NOT EXISTS utm_source text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS utm_medium text NOT NULL DEFAULT 'named';

UPDATE poll_share_links
SET slug = lower(regexp_replace(coalesce(nullif(slug, ''), name, id::text), '[^a-zA-Z0-9_-]+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

ALTER TABLE poll_share_links
    ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS poll_share_links_poll_slug_idx ON poll_share_links(poll_id, slug);
CREATE INDEX IF NOT EXISTS poll_share_links_poll_id_idx ON poll_share_links(poll_id);

ALTER TABLE traffic_events
    ADD COLUMN IF NOT EXISTS share_link_id uuid REFERENCES poll_share_links(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS traffic_events_share_link_created_at_idx ON traffic_events(share_link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS polls_visibility_created_at_idx ON polls(visibility, created_at DESC);
