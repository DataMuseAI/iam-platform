-- IAM database only: Maintenance stored procedure for data retention & TTL purges (SEC-IAM-08)

CREATE OR REPLACE FUNCTION purge_expired_iam_records()
RETURNS TABLE (
  expired_invitations_marked bigint,
  idempotency_purged bigint,
  outbox_purged bigint
) AS $$
DECLARE
  v_inv bigint;
  v_idemp bigint;
  v_outbox bigint;
BEGIN
  -- Mark overdue pending invitations as expired
  WITH updated AS (
    UPDATE invitations
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at < now()
    RETURNING id
  )
  SELECT count(*) INTO v_inv FROM updated;

  -- Delete idempotency records older than 7 days
  WITH deleted_idemp AS (
    DELETE FROM idempotency_records
    WHERE created_at < now() - interval '7 days'
    RETURNING actor_id
  )
  SELECT count(*) INTO v_idemp FROM deleted_idemp;

  -- Delete outbox records delivered more than 30 days ago
  WITH deleted_outbox AS (
    DELETE FROM outbox
    WHERE delivered_at IS NOT NULL AND delivered_at < now() - interval '30 days'
    RETURNING id
  )
  SELECT count(*) INTO v_outbox FROM deleted_outbox;

  RETURN QUERY SELECT v_inv, v_idemp, v_outbox;
END;
$$ LANGUAGE plpgsql;
