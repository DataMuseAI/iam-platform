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
      await client.query('BEGIN');
      try {
        await client.query(readFileSync(path, 'utf8'));
        await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [version]);
        await client.query('COMMIT');
      } catch (e) { await client.query('ROLLBACK'); throw e; }
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
await apply(process.env.DEMO_DATABASE_URL ?? '', 'db/002_demo.sql', '002_demo');
await apply(process.env.WEB_DATABASE_URL ?? '', 'db/004_web_sessions.sql', '004_web_sessions');
