import 'dotenv/config';
import {Pool} from 'pg';

const client = process.env.LEADFLOW_SERVICE_CLIENT_ID;
const subject = process.env.LEADFLOW_SERVICE_SUBJECT;
const audience = process.env.LEADFLOW_API_AUDIENCE;

if (!client || !subject || !audience) {
  throw new Error('Set LEADFLOW_SERVICE_CLIENT_ID, LEADFLOW_SERVICE_SUBJECT, LEADFLOW_API_AUDIENCE');
}

const db = new Pool({connectionString: process.env.IAM_DATABASE_URL});

try {
  const p = await db.query(`
    INSERT INTO products(code, api_audience, service_client_id, service_subject)
    VALUES('leadflow', $1, $2, $3)
    ON CONFLICT(code) DO UPDATE SET
      api_audience = EXCLUDED.api_audience,
      service_client_id = EXCLUDED.service_client_id,
      service_subject = EXCLUDED.service_subject
    RETURNING id
  `, [audience, client, subject]);
  
  const permissions = [
    ['leadflow:conversation:read', 'routine'],
    ['leadflow:conversation:reply', 'routine'],
    ['leadflow:case:claim', 'routine'],
    ['leadflow:tenant:manage', 'critical']
  ];
  
  for (const [name, risk] of permissions) {
    await db.query(`
      INSERT INTO permissions(product_id, name, risk)
      VALUES($1, $2, $3)
      ON CONFLICT(product_id, name) DO UPDATE SET risk = EXCLUDED.risk
    `, [p.rows[0].id, name, risk]);
  }
  
  process.stdout.write(`product_id=${p.rows[0].id}\n`);
} finally {
  await db.end();
}
