-- IAM database only: Immutability triggers for audit_events (SEC-IAM-09)
-- Prohibits modifications and deletions of historical security events to guarantee non-repudiation.

CREATE OR REPLACE FUNCTION enforce_audit_immutability()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is strictly append-only: modifications and deletions are prohibited (SEC-IAM-09)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_events_immutable ON audit_events;
CREATE TRIGGER trg_audit_events_immutable
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW
EXECUTE FUNCTION enforce_audit_immutability();
