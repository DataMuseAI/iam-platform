import 'dotenv/config';
import {Pool} from 'pg';
const client=process.env.DEMO_SERVICE_CLIENT_ID;
const subject=process.env.DEMO_SERVICE_SUBJECT;
const audience=process.env.DEMO_API_AUDIENCE;
if(!client || !subject || !audience)throw new Error('Set DEMO_SERVICE_CLIENT_ID, DEMO_SERVICE_SUBJECT, DEMO_API_AUDIENCE');
const db=new Pool({connectionString:process.env.IAM_DATABASE_URL});
try {
 const p=await db.query(`INSERT INTO products(code,api_audience,service_client_id,service_subject)
 VALUES('demo', $1,$2,$3) ON CONFLICT(code) DO UPDATE SET api_audience=EXCLUDED.api_audience,
 service_client_id=EXCLUDED.service_client_id,service_subject=EXCLUDED.service_subject RETURNING id`,[audience,client,subject]);
 for(const [name,risk] of [['demo:widget:read','routine'],['demo:widget:write','critical']]){
  await db.query(`INSERT INTO permissions(product_id,name,risk) VALUES($1,$2,$3) ON CONFLICT(product_id,name) DO UPDATE SET risk=EXCLUDED.risk`,[p.rows[0].id,name,risk]);
 }
 process.stdout.write(`product_id=${p.rows[0].id}\n`);
}finally{await db.end();}
