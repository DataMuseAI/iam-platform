-- IAM database only. Apply using the repository migration runner after 003.
CREATE TABLE idempotency_records (
 actor_id uuid NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
 idempotency_key uuid NOT NULL,
 request_hash bytea NOT NULL,
 response jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,idempotency_key)
);
CREATE INDEX idempotency_created_idx ON idempotency_records(created_at);
-- Retain keys at least as long as your documented retry window; schedule controlled cleanup.
