-- Demo product database: Row-Level Security for multi-tenant isolation (SEC-IAM-02)
-- Enforces that widgets only permit access when matching app.current_tenant_id,
-- or when explicitly running in platform/system context ('platform' or '*').

ALTER TABLE widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE widgets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON widgets;
CREATE POLICY tenant_isolation_policy ON widgets
FOR ALL
USING (
  current_setting('app.current_tenant_id', true) = '*'
  OR current_setting('app.current_tenant_id', true) = 'platform'
  OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
)
WITH CHECK (
  current_setting('app.current_tenant_id', true) = '*'
  OR current_setting('app.current_tenant_id', true) = 'platform'
  OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);
