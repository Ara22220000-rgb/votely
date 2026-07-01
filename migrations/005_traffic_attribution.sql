CREATE TABLE traffic_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type text NOT NULL CHECK (event_type IN ('visit', 'vote')),
    path text NOT NULL CHECK (char_length(path) <= 2048),
    method text NOT NULL CHECK (char_length(method) <= 16),
    poll_id uuid REFERENCES polls(id) ON DELETE SET NULL,
    option_id uuid REFERENCES poll_options(id) ON DELETE SET NULL,
    voter_token_hash text CHECK (voter_token_hash IS NULL OR char_length(voter_token_hash) = 64),
    ip_hash text CHECK (ip_hash IS NULL OR char_length(ip_hash) = 64),
    device_hash text CHECK (device_hash IS NULL OR char_length(device_hash) = 64),
    user_agent text NOT NULL DEFAULT '' CHECK (char_length(user_agent) <= 1024),
    referrer text NOT NULL DEFAULT '' CHECK (char_length(referrer) <= 2048),
    landing_url text NOT NULL DEFAULT '' CHECK (char_length(landing_url) <= 2048),
    utm_source text NOT NULL DEFAULT '' CHECK (char_length(utm_source) <= 256),
    utm_medium text NOT NULL DEFAULT '' CHECK (char_length(utm_medium) <= 256),
    utm_campaign text NOT NULL DEFAULT '' CHECK (char_length(utm_campaign) <= 256),
    utm_term text NOT NULL DEFAULT '' CHECK (char_length(utm_term) <= 256),
    utm_content text NOT NULL DEFAULT '' CHECK (char_length(utm_content) <= 256),
    ip_country text NOT NULL DEFAULT '',
    ip_region text NOT NULL DEFAULT '',
    ip_city text NOT NULL DEFAULT '',
    ip_geo_source text NOT NULL DEFAULT 'unknown',
    accept_language text NOT NULL DEFAULT '' CHECK (char_length(accept_language) <= 256),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX traffic_events_created_at_idx ON traffic_events(created_at DESC);
CREATE INDEX traffic_events_event_type_created_at_idx ON traffic_events(event_type, created_at DESC);
CREATE INDEX traffic_events_poll_created_at_idx ON traffic_events(poll_id, created_at DESC);
CREATE INDEX traffic_events_utm_source_created_at_idx ON traffic_events(utm_source, created_at DESC);
