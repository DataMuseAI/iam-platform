import 'dotenv/config';
import {Pool} from 'pg';
const [tenantId,name]=process.argv.slice(2);
if(!tenantId || !name)throw new Error('Usage: npm run widget:create -- <tenant_uuid> <name>');
const db=new Pool({connectionString:process.env.DEMO_DATABASE_URL});
try{const r=await db.query('INSERT INTO widgets(tenant_id,name) VALUES($1,$2) RETURNING id',[tenantId,name]);process.stdout.write(`widget_id=${r.rows[0].id}\n`);}finally{await db.end();}
