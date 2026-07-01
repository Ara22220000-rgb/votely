-- Migration: Add metadata columns to poll_votes
-- Run this to add tracking columns for analytics

-- Add new columns if they don't exist
ALTER TABLE poll_votes 
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS ip_address INET,
ADD COLUMN IF NOT EXISTS utm_source VARCHAR(255) DEFAULT '',
ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(255) DEFAULT '',
ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(255) DEFAULT '',
ADD COLUMN IF NOT EXISTS device_type VARCHAR(50) DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS os_type VARCHAR(100) DEFAULT 'Unknown';

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_poll_votes_utm_source ON poll_votes(utm_source);
CREATE INDEX IF NOT EXISTS idx_poll_votes_utm_campaign ON poll_votes(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_poll_votes_device_type ON poll_votes(device_type);
CREATE INDEX IF NOT EXISTS idx_poll_votes_os_type ON poll_votes(os_type);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON poll_votes(poll_id);

-- Add owner_key_hash to polls for stats access control
ALTER TABLE polls 
ADD COLUMN IF NOT EXISTS owner_key_hash VARCHAR(64);

-- Generate owner keys for existing polls (if needed)
-- UPDATE polls SET owner_key_hash = hash('sha256', 'owner:' || gen_random_uuid()::text) WHERE owner_key_hash IS NULL;
