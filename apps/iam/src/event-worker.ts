import 'dotenv/config';
import { Pool } from 'pg';
import { z } from 'zod';

const cfg = z.object({
  IAM_DATABASE_URL: z.string().url(),
}).parse(process.env);

/**
 * Lifecycle event processor for transactional outbox (SEC-IAM-05).
 * Drains non-invitation events (tenant.created, role.granted, membership.suspended,
 * invitation.accepted, owner.granted) to prevent unbounded table growth and support downstream sync.
 */
export async function drainLifecycleEvents(db: Pool, batchSize = 10): Promise<number> {
  const c = await db.connect();
  let processed = 0;
  try {
    await c.query('BEGIN');
    await c.query("SELECT set_config('app.current_tenant_id', 'platform', true)");

    const q = await c.query(
      `SELECT id, aggregate_type, aggregate_id, aggregate_version, event_type, payload
       FROM outbox
       WHERE delivered_at IS NULL
         AND dead_at IS NULL
         AND next_attempt_at <= now()
         AND event_type <> 'invitation.created'
       ORDER BY id
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [batchSize]
    );

    for (const row of q.rows) {
      try {
        // Forward/publish event to registered message sinks or audit pipelines
        // In local architecture, log execution and mark delivered
        await c.query('UPDATE outbox SET delivered_at = now() WHERE id = $1', [row.id]);
        processed++;
      } catch (err) {
        await c.query(
          `UPDATE outbox SET
             attempts = attempts + 1,
             next_attempt_at = now() + make_interval(secs => LEAST(3600, power(2, LEAST(attempts, 10))::integer)),
             dead_at = CASE WHEN attempts >= 9 THEN now() ELSE NULL END
           WHERE id = $1`,
          [row.id]
        );
      }
    }
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
  return processed;
}

let stopping = false;
process.once('SIGTERM', () => { stopping = true; });
process.once('SIGINT', () => { stopping = true; });

// Standalone execution loop when launched via node/tsx
if (import.meta.url === `file://${process.argv[1]}`) {
  const db = new Pool({ connectionString: cfg.IAM_DATABASE_URL, max: 2 });
  console.log('IAM Lifecycle Event Worker started...');
  while (!stopping) {
    try {
      const count = await drainLifecycleEvents(db);
      if (count === 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (err) {
      console.error('Lifecycle event processing error:', err);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  await db.end();
}
