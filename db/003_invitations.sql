-- IAM DB only; migration runner wraps SQL and schema_migrations insert in one transaction.
CREATE TABLE invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL, product_id uuid NOT NULL, role_id uuid NOT NULL,
 email_normalized text NOT NULL CHECK(length(email_normalized) BETWEEN 3 AND 320),
 token_hash bytea NOT NULL UNIQUE,
 token_ciphertext bytea, token_iv bytea, token_tag bytea,
 invited_by uuid NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked','expired')),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 accepted_by uuid REFERENCES identities(id),
 emailed_at timestamptz,
 FOREIGN KEY(tenant_id,product_id) REFERENCES tenant_products(tenant_id,product_id),
 FOREIGN KEY(role_id,tenant_id,product_id) REFERENCES roles(id,tenant_id,product_id),
 FOREIGN KEY(tenant_id,invited_by) REFERENCES memberships(tenant_id,identity_id),
 CHECK(expires_at > created_at)
);
CREATE INDEX invitations_lookup_pending ON invitations(tenant_id,email_normalized) WHERE status='pending';
CREATE INDEX invitations_expiration ON invitations(expires_at) WHERE status='pending';
ALTER TABLE outbox ADD COLUMN attempts integer NOT NULL DEFAULT 0;
ALTER TABLE outbox ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE outbox ADD COLUMN dead_at timestamptz;
