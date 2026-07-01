CREATE TABLE poll_votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_id uuid NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX poll_votes_poll_id_idx ON poll_votes(poll_id);
CREATE INDEX poll_votes_option_id_idx ON poll_votes(option_id);
