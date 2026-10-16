-- CONCURRENT
-- IAM database only: Performance indexes for Outbox Event Processing (SEC-IAM-05)
-- Eliminates sequential table scans on pending outbox events and accelerates cleanup routines.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_outbox_pending_events
  ON outbox(event_type, next_attempt_at)
  WHERE delivered_at IS NULL AND dead_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_outbox_delivered_cleanup
  ON outbox(delivered_at)
  WHERE delivered_at IS NOT NULL;
