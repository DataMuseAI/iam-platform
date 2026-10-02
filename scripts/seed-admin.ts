import 'dotenv/config';
import {Pool} from 'pg';
const [issuer,subject] = process.argv.slice(2);
if(!issuer || !subject || issuer!==process.env.OIDC_ISSUER) throw new Error('Usage: npm run seed:admin -- <OIDC_ISSUER> <existing Keycloak user sub>');
const db=new Pool({connectionString:process.env.IAM_DATABASE_URL});
try{
 await db.query('BEGIN');
 const r=await db.query(`INSERT INTO identities(issuer,subject) VALUES($1,$2) ON CONFLICT(issuer,subject)
 DO UPDATE SET subject=EXCLUDED.subject RETURNING id`,[issuer,subject]);
 await db.query('INSERT INTO platform_admins(identity_id) VALUES($1) ON CONFLICT DO NOTHING',[r.rows[0].id]);
 await db.query('COMMIT');
} catch(e){await db.query('ROLLBACK');throw e;} finally{await db.end();}
