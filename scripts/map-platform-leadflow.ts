import 'dotenv/config';
import {Pool} from 'pg';

const db = new Pool({connectionString: process.env.IAM_DATABASE_URL});

try {
  await db.query('BEGIN');
  const t = await db.query("SELECT id FROM tenants WHERE slug='platform'");
  if(!t.rowCount) throw new Error('Platform tenant not found');
  const tenantId = t.rows[0].id;

  const p = await db.query("SELECT id FROM products WHERE code='leadflow'");
  if(!p.rowCount) throw new Error('Leadflow product not found');
  const productId = p.rows[0].id;

  await db.query(`
    INSERT INTO tenant_products (tenant_id, product_id, status)
    VALUES ($1, $2, 'active')
    ON CONFLICT DO NOTHING
  `, [tenantId, productId]);

  const permRes = await db.query("SELECT id FROM permissions WHERE product_id=$1 AND name='leadflow:tenant:manage'", [productId]);
  if(!permRes.rowCount) throw new Error('Permission not found');
  const permId = permRes.rows[0].id;

  const roleRes = await db.query(`
    INSERT INTO roles (tenant_id, product_id, name)
    VALUES ($1, $2, 'admin')
    ON CONFLICT (tenant_id, product_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `, [tenantId, productId]);
  const roleId = roleRes.rows[0].id;

  await db.query(`
    INSERT INTO role_permissions (tenant_id, product_id, role_id, permission_id)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT DO NOTHING
  `, [tenantId, productId, roleId, permId]);

  const identRes = await db.query("SELECT id FROM identities WHERE issuer=$1", [process.env.OIDC_ISSUER]);
  if(identRes.rowCount) {
      await db.query(`
        INSERT INTO role_assignments (tenant_id, identity_id, product_id, role_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `, [tenantId, identRes.rows[0].id, productId, roleId]);
  }

  await db.query('COMMIT');
  console.log('Granted leadflow:tenant:manage to platform tenant admin');
} catch (e) {
  await db.query('ROLLBACK');
  console.error(e);
} finally {
  await db.end();
}
