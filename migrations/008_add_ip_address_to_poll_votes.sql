-- Migration: Add poll_share_links table and ip_address/share_link_id to poll_votes

-- Create poll_share_links table if it doesn't exist
CREATE TABLE IF NOT EXISTS poll_share_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    name text NOT NULL,
    utm_source text NOT NULL DEFAULT '',
    utm_medium text NOT NULL DEFAULT 'shared',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poll_share_links_poll_id ON poll_share_links(poll_id);

-- Add ip_address column if it doesn't exist
ALTER TABLE poll_votes 
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45) DEFAULT '';

-- Add share_link_id column if it doesn't exist
ALTER TABLE poll_votes 
ADD COLUMN IF NOT EXISTS share_link_id uuid REFERENCES poll_share_links(id) ON DELETE SET NULL;

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_poll_votes_ip_address ON poll_votes(ip_address);
CREATE INDEX IF NOT EXISTS idx_poll_votes_share_link_id ON poll_votes(share_link_id);
