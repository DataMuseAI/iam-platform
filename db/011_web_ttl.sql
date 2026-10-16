-- Web database only: Stored procedure for purging expired OAuth flows and web sessions (SEC-IAM-08)

CREATE OR REPLACE FUNCTION purge_expired_web_records()
RETURNS TABLE (
  flows_purged bigint,
  sessions_purged bigint
) AS $$
DECLARE
  v_flows bigint;
  v_sessions bigint;
BEGIN
  WITH deleted_flows AS (
    DELETE FROM oauth_flows
    WHERE expires_at < now()
    RETURNING state_hash
  )
  SELECT count(*) INTO v_flows FROM deleted_flows;

  WITH deleted_sessions AS (
    DELETE FROM web_sessions
    WHERE expires_at < now()
    RETURNING id_hash
  )
  SELECT count(*) INTO v_sessions FROM deleted_sessions;

  RETURN QUERY SELECT v_flows, v_sessions;
END;
$$ LANGUAGE plpgsql;
