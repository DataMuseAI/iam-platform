import 'dotenv/config';
import { Pool } from 'pg';
import { z } from 'zod';

const cfg = z.object({
  IAM_DATABASE_URL: z.string().url(),
  WEB_DATABASE_URL: z.string().url().optional(),
}).parse(process.env);

/**
 * Runs maintenance TTL purge on IAM database (SEC-IAM-08).
 * Deletes old idempotency records (>7d), delivered outbox (>30d), and marks expired invites.
 */
export async function runIamMaintenance(db: Pool): Promise<{
  expiredInvitationsMarked: number;
  idempotencyPurged: number;
  outboxPurged: number;
}> {
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT set_config('app.current_tenant_id', 'platform', true)");
    const r = await c.query('SELECT * FROM purge_expired_iam_records()');
    await c.query('COMMIT');
    const row = r.rows[0] || {};
    return {
      expiredInvitationsMarked: Number(row.expired_invitations_marked || 0),
      idempotencyPurged: Number(row.idempotency_purged || 0),
      outboxPurged: Number(row.outbox_purged || 0),
    };
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

/**
 * Runs maintenance TTL purge on Web database (SEC-IAM-08).
 * Deletes expired OAuth flow states and expired user sessions.
 */
export async function runWebMaintenance(db: Pool): Promise<{
  flowsPurged: number;
  sessionsPurged: number;
}> {
  const r = await db.query('SELECT * FROM purge_expired_web_records()');
  const row = r.rows[0] || {};
  return {
    flowsPurged: Number(row.flows_purged || 0),
    sessionsPurged: Number(row.sessions_purged || 0),
  };
}

// Standalone execution loop when invoked via CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running IAM platform automated data retention purges...');
  const iamDb = new Pool({ connectionString: cfg.IAM_DATABASE_URL });
  const iamResult = await runIamMaintenance(iamDb);
  console.log('IAM Database Purge Result:', iamResult);
  await iamDb.end();

  if (cfg.WEB_DATABASE_URL) {
    const webDb = new Pool({ connectionString: cfg.WEB_DATABASE_URL });
    const webResult = await runWebMaintenance(webDb);
    console.log('Web Database Purge Result:', webResult);
    await webDb.end();
  }
  console.log('Automated retention maintenance complete.');
}
