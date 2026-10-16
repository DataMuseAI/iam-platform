import 'dotenv/config';
import {Pool} from 'pg';
const [tenantId,name]=process.argv.slice(2);
if(!tenantId || !name)throw new Error('Usage: npm run widget:create -- <tenant_uuid> <name>');
const db=new Pool({connectionString:process.env.DEMO_DATABASE_URL});
try {
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
    const r = await c.query('INSERT INTO widgets(tenant_id,name) VALUES($1,$2) RETURNING id', [tenantId, name]);
    await c.query('COMMIT');
    process.stdout.write(`widget_id=${r.rows[0].id}\n`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
} finally {
  await db.end();
}
