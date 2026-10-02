CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE widgets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,name text NOT NULL,UNIQUE(tenant_id,id));
CREATE INDEX widgets_by_tenant ON widgets(tenant_id,id);
