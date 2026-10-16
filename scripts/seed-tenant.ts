import 'dotenv/config';
import {Pool} from 'pg';

const db = new Pool({connectionString: process.env.IAM_DATABASE_URL});

try {
  await db.query('BEGIN');
  await db.query("SELECT set_config('app.current_tenant_id', 'platform', true)");
  
  // Find or insert identity for operator
  const identRes = await db.query(
    'SELECT id FROM identities WHERE issuer=$1',
    [process.env.OIDC_ISSUER]
  );
  if (!identRes.rowCount) {
    throw new Error('Operator identity not found in database. Seed admin first.');
  }
  const identityId = identRes.rows[0].id;

  // Find product
  const prodRes = await db.query("SELECT id FROM products WHERE code='demo'");
  if (!prodRes.rowCount) {
    throw new Error('Demo product not found. Run seed:demo first.');
  }
  const productId = prodRes.rows[0].id;

  // Create tenant
  const tenantRes = await db.query(`
    INSERT INTO tenants (slug, name, status, authz_version)
    VALUES ('demo-corp', 'Demo Corporation', 'active', 1)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `);
  const tenantId = tenantRes.rows[0].id;

  // Link tenant product
  await db.query(`
    INSERT INTO tenant_products (tenant_id, product_id, status)
    VALUES ($1, $2, 'active')
    ON CONFLICT (tenant_id, product_id) DO NOTHING
  `, [tenantId, productId]);

  // Create membership for operator as owner
  await db.query(`
    INSERT INTO memberships (tenant_id, identity_id, status, is_owner)
    VALUES ($1, $2, 'active', true)
    ON CONFLICT (tenant_id, identity_id) DO UPDATE SET is_owner = true, status = 'active'
  `, [tenantId, identityId]);

  // Create roles
  for (const name of ['owner', 'admin', 'viewer']) {
    const roleRes = await db.query(`
      INSERT INTO roles (tenant_id, product_id, name)
      VALUES ($1, $2, $3)
      ON CONFLICT (tenant_id, product_id, name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [tenantId, productId, name]);
    const roleId = roleRes.rows[0].id;

    // Attach permissions
    await db.query(`
      INSERT INTO role_permissions (tenant_id, product_id, role_id, permission_id)
      SELECT $1, $2, $3, id FROM permissions
      WHERE product_id = $2 AND ($4 <> 'viewer' OR risk = 'routine')
      ON CONFLICT DO NOTHING
    `, [tenantId, productId, roleId, name]);

    // Assign owner role to operator
    if (name === 'owner') {
      await db.query(`
        INSERT INTO role_assignments (tenant_id, identity_id, product_id, role_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `, [tenantId, identityId, productId, roleId]);
    }
  }

  await db.query('COMMIT');
  console.log(`Tenant created: demo-corp (id: ${tenantId}) with operator as owner.`);
} catch (e) {
  await db.query('ROLLBACK');
  console.error(e);
  process.exit(1);
} finally {
  await db.end();
}
