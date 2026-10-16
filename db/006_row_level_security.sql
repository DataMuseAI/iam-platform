-- IAM database only: Row-Level Security for multi-tenant isolation (SEC-IAM-02)
-- Enforces that tenant-scoped tables only permit access when matching app.current_tenant_id,
-- or when explicitly running in platform/system context ('platform' or '*').

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'memberships',
    'tenant_products',
    'roles',
    'role_permissions',
    'role_assignments',
    'invitations',
    'audit_events'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', tbl);
    EXECUTE format($pol$
      CREATE POLICY tenant_isolation_policy ON %I
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
      )
    $pol$, tbl);
  END LOOP;
END $$;
