ALTER TABLE poll_votes
    ADD COLUMN voter_token_hash text,
    ADD COLUMN ip_hash text,
    ADD COLUMN device_hash text;

ALTER TABLE poll_votes
    ADD CONSTRAINT poll_votes_voter_token_hash_length_check CHECK (voter_token_hash IS NULL OR char_length(voter_token_hash) = 64),
    ADD CONSTRAINT poll_votes_ip_hash_length_check CHECK (ip_hash IS NULL OR char_length(ip_hash) = 64),
    ADD CONSTRAINT poll_votes_device_hash_length_check CHECK (device_hash IS NULL OR char_length(device_hash) = 64);

CREATE UNIQUE INDEX poll_votes_poll_voter_token_hash_unique
    ON poll_votes(poll_id, voter_token_hash)
    WHERE voter_token_hash IS NOT NULL;

CREATE UNIQUE INDEX poll_votes_poll_ip_hash_unique
    ON poll_votes(poll_id, ip_hash)
    WHERE ip_hash IS NOT NULL;

CREATE UNIQUE INDEX poll_votes_poll_device_hash_unique
    ON poll_votes(poll_id, device_hash)
    WHERE device_hash IS NOT NULL;
