import 'dotenv/config';
import {Pool} from 'pg';
import nodemailer from 'nodemailer';
import {z} from 'zod';
import {decryptInvite,inviteKey} from './invite-crypto.js';
const cfg=z.object({
 IAM_DATABASE_URL:z.string().url(), INVITE_TOKEN_KEY_BASE64:z.string().min(1),
 SMTP_HOST:z.string().min(1), SMTP_PORT:z.coerce.number().int().positive(),
 SMTP_FROM:z.string().email(), INVITE_ACCEPT_URL:z.string().url(),
 SMTP_USER:z.string().optional(), SMTP_PASSWORD:z.string().optional(),
 SMTP_TLS:z.enum(['true','false']).default('false')
}).parse(process.env);
const key=inviteKey(cfg.INVITE_TOKEN_KEY_BASE64);
const db=new Pool({connectionString:cfg.IAM_DATABASE_URL,max:2});
const smtp=nodemailer.createTransport({host:cfg.SMTP_HOST,port:cfg.SMTP_PORT,
 secure:cfg.SMTP_TLS==='true',auth:cfg.SMTP_USER?{user:cfg.SMTP_USER,pass:cfg.SMTP_PASSWORD}:undefined,
 connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000});
let stopping=false;
process.once('SIGTERM',()=>{stopping=true;});process.once('SIGINT',()=>{stopping=true;});
async function deliverOne():Promise<boolean>{
 const c=await db.connect();
 let jobId:bigint|null=null;
 try{
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.current_tenant_id', 'platform', true)");
  const q=await c.query(`SELECT id,payload FROM outbox WHERE delivered_at IS NULL AND dead_at IS NULL AND next_attempt_at<=now()
     AND event_type='invitation.created' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`);
  if(!q.rowCount){await c.query('COMMIT');return false;}
  const job=q.rows[0],id=job.payload.invitation_id;jobId=BigInt(job.id);
  const inv=await c.query(`SELECT email_normalized,token_ciphertext,token_iv,token_tag,status,expires_at
    FROM invitations WHERE id=$1`,[id]);
  const row=inv.rows[0];
  if(!row || row.status!=='pending' || new Date(row.expires_at).getTime()<=Date.now()){
   await c.query('UPDATE outbox SET delivered_at=now() WHERE id=$1',[job.id]);
   await c.query('COMMIT');return true;
  }
  const token=decryptInvite(key,row.token_iv,row.token_ciphertext,row.token_tag);
  const url=new URL(cfg.INVITE_ACCEPT_URL);url.hash='token='+encodeURIComponent(token);
  await smtp.sendMail({from:cfg.SMTP_FROM,to:row.email_normalized,
    subject:'Invitation to join a tenant',
    text:`You were invited to join a tenant. Open the link and sign in with this verified email address: ${url.toString()}\nThis invitation expires in seven days. If unexpected, ignore it.`});
  await c.query('UPDATE invitations SET emailed_at=now() WHERE id=$1',[id]);
  await c.query('UPDATE outbox SET delivered_at=now() WHERE id=$1',[job.id]);
  await c.query('COMMIT');return true;
 }catch(e){
  await c.query('ROLLBACK');
  if(jobId!==null) {
   try { await db.query(`UPDATE outbox SET attempts=attempts+1,
     next_attempt_at=now()+make_interval(secs=>LEAST(3600, power(2,LEAST(attempts,10))::integer)),
     dead_at=CASE WHEN attempts>=9 THEN now() ELSE NULL END WHERE id=$1`,[jobId.toString()]); }
   catch {console.error('Mail outbox retry update failed');}
  }
  console.error('Mail delivery failed (token not logged)');return false;
 }
 finally{c.release();}
}
while(!stopping){const worked=await deliverOne();if(!worked)await new Promise(resolve=>setTimeout(resolve,2000));}
await smtp.close();await db.end();
