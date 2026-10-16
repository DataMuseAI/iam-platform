import type {FastifyInstance} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import type {JWTPayload} from 'jose';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {bearer} from '../../../packages/security/src/tokens.js';
import {inviteKey,newInvite,inviteHash,equalInviteToken,normalizedEmail} from './invite-crypto.js';

type Verify=(token:string,audience:string)=>Promise<JWTPayload>;
type Config={OIDC_ISSUER:string;IAM_API_AUDIENCE:string;IAM_ADMIN_ACR:string;INVITE_TOKEN_KEY_BASE64:string};
const tenantPath=z.object({tenant_id:z.string().uuid()});
const ownerPath=z.object({tenant_id:z.string().uuid(),identity_id:z.string().uuid()});
const inviteInput=z.object({email:z.string().email().max(320),role_id:z.string().uuid()}).strict();
const acceptInput=z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict();
async function tx<T>(db:Pool,fn:(c:PoolClient)=>Promise<T>,tenantId?:string):Promise<T> {
 const c=await db.connect();
 try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId ?? 'platform']);
  const result=await fn(c);
  await c.query('COMMIT');
  return result;
 }
 catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
async function principal(db:Pool,verify:Verify,cfg:Config,header:string|undefined) {
 const claims=await verify(bearer(header),cfg.IAM_API_AUDIENCE);
 const r=await db.query('SELECT id FROM identities WHERE issuer=$1 AND subject=$2',[cfg.OIDC_ISSUER,claims.sub]);
 if(!r.rowCount)throw new Error('Unknown identity');
 return {id:r.rows[0].id,claims};
}
async function owner(c:PoolClient,tenant:string,actor:string){
 const r=await c.query(`SELECT 1 FROM memberships m JOIN tenants t ON t.id=m.tenant_id
 WHERE m.tenant_id=$1 AND m.identity_id=$2 AND m.is_owner=true
 AND m.status='active' AND t.status='active'`,[tenant,actor]);
 if(!r.rowCount)throw new Error('Owner permission required');
}
async function event(c:PoolClient,tenant:string,actor:string|null,type:string,target:string,payload:Record<string,string>) {
 const t=await c.query('UPDATE tenants SET authz_version=authz_version+1 WHERE id=$1 RETURNING authz_version',[tenant]);
 if(!t.rowCount)throw new Error('Tenant missing');
 await c.query('INSERT INTO audit_events(tenant_id,actor_id,event_type,target_id,correlation_id) VALUES($1,$2,$3,$4,$5)',[tenant,actor,type,target,randomUUID()]);
 await c.query('INSERT INTO outbox(aggregate_type,aggregate_id,aggregate_version,event_type,payload) VALUES($1,$2,$3,$4,$5)', ['tenant',tenant,t.rows[0].authz_version,type,JSON.stringify(payload)]);
}
export function registerOnboarding(app:FastifyInstance,db:Pool,verify:Verify,cfg:Config) {
 const key=inviteKey(cfg.INVITE_TOKEN_KEY_BASE64);
 app.post('/v1/tenants/:tenant_id/invitations',async(req,reply)=>{
  const p=tenantPath.safeParse(req.params),b=inviteInput.safeParse(req.body);
  if(!p.success || !b.success)return reply.code(400).send({code:'INVALID_REQUEST'});
  let actor;
  try{actor=await principal(db,verify,cfg,req.headers.authorization);if(actor.claims.acr!==cfg.IAM_ADMIN_ACR)throw new Error('Owner MFA context required');}catch{return reply.code(401).send({code:'UNAUTHENTICATED'});}
  try{
   const result=await tx(db,async c=>{
    await owner(c,p.data.tenant_id,actor.id);
    const role=await c.query(`SELECT r.product_id,r.name FROM roles r JOIN tenant_products tp
      ON tp.tenant_id=r.tenant_id AND tp.product_id=r.product_id
      WHERE r.id=$1 AND r.tenant_id=$2 AND tp.status='active'`,[b.data.role_id,p.data.tenant_id]);
    if(!role.rowCount || role.rows[0].name==='owner')throw new Error('Invalid invite role');
    const secret=newInvite(key),email=normalizedEmail(b.data.email);
    const inv=await c.query(`INSERT INTO invitations(tenant_id,product_id,role_id,email_normalized,token_hash,
      token_ciphertext,token_iv,token_tag,invited_by,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now()+interval '7 days') RETURNING id,expires_at`,
      [p.data.tenant_id,role.rows[0].product_id,b.data.role_id,email,secret.hash,secret.ciphertext,secret.iv,secret.tag,actor.id]);
    await event(c,p.data.tenant_id,actor.id,'invitation.created',inv.rows[0].id,{invitation_id:inv.rows[0].id});
    return {invitation_id:inv.rows[0].id,expires_at:inv.rows[0].expires_at};
   }, p.data.tenant_id);
   return reply.code(202).send(result);
  }catch(e){req.log.warn({reason:'invite rejected'});return reply.code(403).send({code:'DENIED'});}
 });
 app.post('/v1/invitations/accept',async(req,reply)=>{
  const b=acceptInput.safeParse(req.body);
  if(!b.success)return reply.code(400).send({code:'INVALID_INVITATION'});
  let claims:JWTPayload;
  try {claims=await verify(bearer(req.headers.authorization),cfg.IAM_API_AUDIENCE);}
  catch{return reply.code(401).send({code:'UNAUTHENTICATED'});}
  if(claims.email_verified!==true || typeof claims.email!=='string' || !claims.sub)
   return reply.code(403).send({code:'VERIFIED_EMAIL_REQUIRED'});
  const email=normalizedEmail(claims.email),hash=inviteHash(b.data.token);
  try {
   const result=await tx(db,async c=>{
    const r=await c.query('SELECT * FROM invitations WHERE token_hash=$1 FOR UPDATE',[hash]);
    const inv=r.rows[0];
    if(!inv || !equalInviteToken(b.data.token,inv.token_hash) || inv.status!=='pending' || new Date(inv.expires_at).getTime()<=Date.now() || inv.email_normalized!==email)throw new Error('Invalid invitation');
    const t=await c.query(`SELECT 1 FROM tenants t JOIN tenant_products tp ON tp.tenant_id=t.id
      WHERE t.id=$1 AND tp.product_id=$2 AND t.status='active' AND tp.status='active'`,[inv.tenant_id,inv.product_id]);
    if(!t.rowCount)throw new Error('Inactive tenant/product');
    const identity=await c.query(`INSERT INTO identities(issuer,subject) VALUES($1,$2)
      ON CONFLICT(issuer,subject) DO UPDATE SET subject=EXCLUDED.subject RETURNING id`,[cfg.OIDC_ISSUER,claims.sub]);
    const id=identity.rows[0].id;
    const existing=await c.query('SELECT status FROM memberships WHERE tenant_id=$1 AND identity_id=$2 FOR UPDATE',[inv.tenant_id,id]);
    if(existing.rowCount && existing.rows[0].status!=='active')throw new Error('Membership blocked');
    if(!existing.rowCount)await c.query("INSERT INTO memberships(tenant_id,identity_id,status,is_owner) VALUES($1,$2,'active',false)",[inv.tenant_id,id]);
    await c.query('INSERT INTO role_assignments(tenant_id,identity_id,product_id,role_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[inv.tenant_id,id,inv.product_id,inv.role_id]);
    await c.query("UPDATE invitations SET status='accepted',accepted_by=$2,token_ciphertext=NULL,token_iv=NULL,token_tag=NULL WHERE id=$1",[inv.id,id]);
    await event(c,inv.tenant_id,id,'invitation.accepted',id,{identity_id:id,product_id:inv.product_id});
    return {tenant_id:inv.tenant_id,product_id:inv.product_id};
   }, 'platform');
   return reply.code(200).send(result);
  }catch(e){req.log.warn({reason:'invitation rejected'});return reply.code(400).send({code:'INVALID_INVITATION'});}
 });
 app.post('/v1/tenants/:tenant_id/owners/:identity_id',async(req,reply)=>{
  const p=ownerPath.safeParse(req.params);
  if(!p.success)return reply.code(400).send({code:'INVALID_REQUEST'});
  let actor;
  try {actor=await principal(db,verify,cfg,req.headers.authorization);if(actor.claims.acr!==cfg.IAM_ADMIN_ACR)throw new Error('Owner MFA context required');}catch{return reply.code(401).send({code:'UNAUTHENTICATED'});}
  try{
   await tx(db,async c=>{
    await c.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[p.data.tenant_id]);
    await owner(c,p.data.tenant_id,actor.id);
    const member=await c.query("SELECT 1 FROM memberships WHERE tenant_id=$1 AND identity_id=$2 AND status='active' FOR UPDATE",[p.data.tenant_id,p.data.identity_id]);
    if(!member.rowCount)throw new Error('Target must be active');
    const pids=await c.query("SELECT product_id FROM tenant_products WHERE tenant_id=$1 AND status='active'",[p.data.tenant_id]);
    for(const product of pids.rows){
      const r=await c.query("SELECT id FROM roles WHERE tenant_id=$1 AND product_id=$2 AND name='owner'",[p.data.tenant_id,product.product_id]);
      if(!r.rowCount)throw new Error('Owner role missing');
      await c.query('INSERT INTO role_assignments(tenant_id,identity_id,product_id,role_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[p.data.tenant_id,p.data.identity_id,product.product_id,r.rows[0].id]);
    }
    await c.query('UPDATE memberships SET is_owner=true WHERE tenant_id=$1 AND identity_id=$2',[p.data.tenant_id,p.data.identity_id]);
    await event(c,p.data.tenant_id,actor.id,'owner.granted',p.data.identity_id,{identity_id:p.data.identity_id});
   }, p.data.tenant_id);
   return reply.code(204).send();
  }catch(e){req.log.warn({reason:'owner grant rejected'});return reply.code(403).send({code:'DENIED'});}
 });
}
