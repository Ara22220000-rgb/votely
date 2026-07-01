-- Migration: Add location tracking to poll_votes
-- Adds ip_country column for geographic analytics

-- Add ip_country column if it doesn't exist
ALTER TABLE poll_votes 
ADD COLUMN IF NOT EXISTS ip_country VARCHAR(2) DEFAULT '';

-- Add device_type column if it doesn't exist (for PHP version)
ALTER TABLE poll_votes 
ADD COLUMN IF NOT EXISTS device_type VARCHAR(50) DEFAULT 'unknown';

-- Add os_type column if it doesn't exist (for PHP version)
ALTER TABLE poll_votes 
ADD COLUMN IF NOT EXISTS os_type VARCHAR(100) DEFAULT 'Unknown';

-- Add browser_type column if it doesn't exist (for PHP version)
ALTER TABLE poll_votes 
ADD COLUMN IF NOT EXISTS browser_type VARCHAR(100) DEFAULT 'Other';

-- Add user_agent column if it doesn't exist (for PHP version)
ALTER TABLE poll_votes 
ADD COLUMN IF NOT EXISTS user_agent TEXT DEFAULT '';

-- Add utm_source column if it doesn't exist (for PHP version)
ALTER TABLE poll_votes 
ADD COLUMN IF NOT EXISTS utm_source VARCHAR(255) DEFAULT '';

-- Add utm_medium column if it doesn't exist (for PHP version)
ALTER TABLE poll_votes 
ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(255) DEFAULT '';

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_poll_votes_ip_country ON poll_votes(ip_country);
CREATE INDEX IF NOT EXISTS idx_poll_votes_device_type ON poll_votes(device_type);
CREATE INDEX IF NOT EXISTS idx_poll_votes_os_type ON poll_votes(os_type);
CREATE INDEX IF NOT EXISTS idx_poll_votes_browser_type ON poll_votes(browser_type);
CREATE INDEX IF NOT EXISTS idx_poll_votes_utm_source ON poll_votes(utm_source);
