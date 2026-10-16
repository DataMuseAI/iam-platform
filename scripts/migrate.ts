import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';

async function apply(url: string, path: string, version: string) {
  const db = new Pool({ connectionString: url });
  const client = await db.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [248019]);
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const found = await client.query('SELECT 1 FROM schema_migrations WHERE version=$1', [version]);
    if (!found.rowCount) {
      const sql = readFileSync(path, 'utf8');
      const isConcurrent = sql.trimStart().startsWith('-- CONCURRENT');
      if (!isConcurrent) await client.query('BEGIN');
      try {
        if (isConcurrent) {
          const stmts = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
          for (const stmt of stmts) {
            await client.query(stmt);
          }
        } else {
          await client.query(sql);
        }
        await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [version]);
        if (!isConcurrent) await client.query('COMMIT');
      } catch (e) {
        if (!isConcurrent) await client.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [248019]);
    client.release();
    await db.end();
  }
}
await apply(process.env.IAM_DATABASE_URL ?? '', 'db/001_initial.sql', '001_initial');
await apply(process.env.IAM_DATABASE_URL ?? '', 'db/003_invitations.sql', '003_invitations');
await apply(process.env.IAM_DATABASE_URL ?? '', 'db/005_idempotency.sql', '005_idempotency');
await apply(process.env.IAM_DATABASE_URL ?? '', 'db/006_row_level_security.sql', '006_row_level_security');
await apply(process.env.IAM_DATABASE_URL ?? '', 'db/008_outbox_index.sql', '008_outbox_index');
await apply(process.env.IAM_DATABASE_URL ?? '', 'db/009_ttl_cleanup.sql', '009_ttl_cleanup');
await apply(process.env.IAM_DATABASE_URL ?? '', 'db/010_audit_immutability.sql', '010_audit_immutability');
await apply(process.env.DEMO_DATABASE_URL ?? '', 'db/002_demo.sql', '002_demo');
await apply(process.env.DEMO_DATABASE_URL ?? '', 'db/007_demo_rls.sql', '007_demo_rls');
await apply(process.env.WEB_DATABASE_URL ?? '', 'db/004_web_sessions.sql', '004_web_sessions');
await apply(process.env.WEB_DATABASE_URL ?? '', 'db/011_web_ttl.sql', '011_web_ttl');
