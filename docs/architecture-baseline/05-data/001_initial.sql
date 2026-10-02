-- PostgreSQL 17 application schema baseline; run with a migration tool as schema owner.
-- NEVER apply this migration to the Keycloak-owned database. Not executed here.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE identities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), issuer text NOT NULL, subject text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(issuer,subject)
);
CREATE TABLE tenants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE,
 name text NOT NULL, status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 authz_version bigint NOT NULL DEFAULT 1 CHECK(authz_version >= 1),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, name text NOT NULL
);
CREATE TABLE tenant_products (
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
 product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 PRIMARY KEY(tenant_id,product_id)
);
CREATE TABLE memberships (
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
 identity_id uuid NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
 status text NOT NULL CHECK(status IN ('active','suspended','removed')),
 is_owner boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,identity_id)
);
CREATE INDEX membership_identity_idx ON memberships(identity_id,tenant_id);
CREATE TABLE permissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK(name ~ '^[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+$'),
 risk text NOT NULL CHECK(risk IN ('routine','critical')),
 UNIQUE(product_id,name), UNIQUE(id,product_id)
);
CREATE TABLE roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, product_id uuid NOT NULL,
 name text NOT NULL, system_role boolean NOT NULL DEFAULT false,
 FOREIGN KEY(tenant_id,product_id) REFERENCES tenant_products(tenant_id,product_id) ON DELETE RESTRICT,
 UNIQUE(tenant_id,product_id,name), UNIQUE(id,tenant_id,product_id)
);
CREATE TABLE role_permissions (
 tenant_id uuid NOT NULL, product_id uuid NOT NULL, role_id uuid NOT NULL, permission_id uuid NOT NULL,
 PRIMARY KEY(role_id,permission_id),
 FOREIGN KEY(role_id,tenant_id,product_id) REFERENCES roles(id,tenant_id,product_id) ON DELETE RESTRICT,
 FOREIGN KEY(permission_id,product_id) REFERENCES permissions(id,product_id) ON DELETE RESTRICT
);
CREATE TABLE personas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, product_id uuid NOT NULL,
 name text NOT NULL, ui_key text NOT NULL,
 FOREIGN KEY(tenant_id,product_id) REFERENCES tenant_products(tenant_id,product_id) ON DELETE RESTRICT,
 UNIQUE(tenant_id,product_id,name), UNIQUE(id,tenant_id,product_id)
);
CREATE TABLE role_assignments (
 tenant_id uuid NOT NULL, identity_id uuid NOT NULL, product_id uuid NOT NULL, role_id uuid NOT NULL,
 assigned_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,identity_id,product_id,role_id),
 FOREIGN KEY(tenant_id,identity_id) REFERENCES memberships(tenant_id,identity_id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,product_id) REFERENCES tenant_products(tenant_id,product_id) ON DELETE RESTRICT,
 FOREIGN KEY(role_id,tenant_id,product_id) REFERENCES roles(id,tenant_id,product_id) ON DELETE RESTRICT
);
CREATE TABLE persona_assignments (
 tenant_id uuid NOT NULL, identity_id uuid NOT NULL, product_id uuid NOT NULL, persona_id uuid NOT NULL,
 PRIMARY KEY(tenant_id,identity_id,product_id,persona_id),
 FOREIGN KEY(tenant_id,identity_id) REFERENCES memberships(tenant_id,identity_id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,product_id) REFERENCES tenant_products(tenant_id,product_id) ON DELETE RESTRICT,
 FOREIGN KEY(persona_id,tenant_id,product_id) REFERENCES personas(id,tenant_id,product_id) ON DELETE RESTRICT
);
CREATE TABLE invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, product_id uuid NOT NULL,
 role_id uuid NOT NULL, email_normalized text NOT NULL, token_hash bytea NOT NULL UNIQUE,
 invited_by uuid NOT NULL, status text NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','accepted','revoked','expired')),
 expires_at timestamptz NOT NULL, accepted_by uuid REFERENCES identities(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,product_id) REFERENCES tenant_products(tenant_id,product_id) ON DELETE RESTRICT,
 FOREIGN KEY(role_id,tenant_id,product_id) REFERENCES roles(id,tenant_id,product_id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,invited_by) REFERENCES memberships(tenant_id,identity_id) ON DELETE RESTRICT,
 CHECK(expires_at > created_at)
);
CREATE INDEX invitations_pending_idx ON invitations(tenant_id,email_normalized) WHERE status='pending';
CREATE TABLE privacy_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), identity_id uuid NOT NULL REFERENCES identities(id),
 kind text NOT NULL CHECK(kind IN ('access','export','rectify','erase')),
 state text NOT NULL CHECK(state IN ('received','verified','review','completed','refused')),
 requested_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 notes_ref text -- pointer to restricted evidence, not raw sensitive detail
);
CREATE TABLE idempotency_records (
 client_id text NOT NULL, idempotency_key uuid NOT NULL, request_hash bytea NOT NULL,
 response_code integer, response_body jsonb, expires_at timestamptz NOT NULL,
 PRIMARY KEY(client_id,idempotency_key)
);
CREATE TABLE audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES tenants(id),
 actor_identity_id uuid REFERENCES identities(id), event_type text NOT NULL,
 target_type text NOT NULL, target_id uuid, correlation_id uuid NOT NULL,
 event_data jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_tenant_time_idx ON audit_events(tenant_id,created_at);
CREATE TABLE outbox (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, event_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 aggregate_type text NOT NULL, aggregate_id uuid NOT NULL, aggregate_version bigint NOT NULL,
 event_type text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 delivered_at timestamptz,
 UNIQUE(aggregate_type,aggregate_id,aggregate_version)
);
CREATE INDEX outbox_pending_idx ON outbox(id) WHERE delivered_at IS NULL;
COMMIT;
-- Required provisioning: migration role owns schema; runtime app role may insert audit_events
-- but MUST NOT update/delete them. Outbox worker may update delivered_at only via dedicated role.
-- Append-only DB privileges do not stop privileged administrators; ship audit stream to separately
-- controlled immutable storage; protect backups. IdP and product DBs need separate backups.
-- Ownership, active status, invitation single-use and version increment require serialized
-- service transactions and negative concurrency tests; FKs alone cannot enforce them.
