import Fastify from 'fastify';
import { Pool, type PoolClient } from 'pg';
import { registerOnboarding } from './onboarding.js';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { cfg } from './config.js';
import { bearer, clientId, tokenVerifier } from '../../../packages/security/src/tokens.js';
import { decisionAllowed } from '../../../packages/security/src/policy.js';
import { MemoryRateLimiter } from '../../../packages/security/src/rate-limit.js';
import cors from '@fastify/cors';

const app = Fastify({logger: {redact: ['req.headers.authorization', 'req.body.user_access_token']}, bodyLimit: 64_000});
app.register(cors, { origin: '*' });
const db = new Pool({connectionString: cfg.IAM_DATABASE_URL, max: 10});
const verify = tokenVerifier(cfg.OIDC_ISSUER);
const limiter = new MemoryRateLimiter(60_000, 120);

app.addHook('onRequest', async (req, reply) => {
  if (req.url === '/healthz' || req.url === '/readyz') return;
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const check = limiter.check(`ip:${ip}`);
  reply.header('x-ratelimit-remaining', check.remaining);
  reply.header('x-ratelimit-reset', Math.ceil(check.resetAt / 1000));
  if (!check.allowed) {
    reply.header('retry-after', check.retryAfterSec);
    return reply.code(429).send({ code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' });
  }
});
type Principal = { issuer: string; sub: string; identityId: string };
const uuid = z.string().uuid();
const tenantInput = z.object({slug: z.string().regex(/^[a-z0-9-]{3,64}$/), name: z.string().min(1).max(200), owner_issuer: z.string().url(), owner_subject: z.string().min(1), initial_product_id: uuid}).strict();
const decisionInput = z.object({user_access_token: z.string().min(20), tenant_id: uuid, product_id: uuid, permission: z.string().regex(/^[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+$/)}).strict();
const grantInput = z.object({identity_issuer: z.string().url(), identity_subject: z.string().min(1), role_id: uuid}).strict();
const suspendInput = z.object({reason: z.string().min(1).max(500)}).strict();
const idPath = z.object({tenant_id: uuid});
const memberPath = z.object({tenant_id: uuid, identity_id: uuid});

async function identity(client: Pool | PoolClient, issuer: string, sub: string): Promise<string | null> {
 const result = await client.query('SELECT id FROM identities WHERE issuer=$1 AND subject=$2',[issuer,sub]);
 return result.rows[0]?.id ?? null;
}
async function requireUser(header: string | undefined): Promise<Principal> {
 const claims = await verify(bearer(header), cfg.IAM_API_AUDIENCE);
 const id = await identity(db, cfg.OIDC_ISSUER, claims.sub!);
 if (!id) throw new Error('Identity not registered');
 return {issuer: cfg.OIDC_ISSUER,sub: claims.sub!,identityId:id};
}
async function requirePlatformAdmin(header: string | undefined): Promise<Principal> {
 const user = await requireUser(header);
 const claims=await verify(bearer(header),cfg.IAM_API_AUDIENCE);
 if(claims.acr!==cfg.IAM_ADMIN_ACR) throw new Error('Admin MFA context required');
 const r = await db.query('SELECT 1 FROM platform_admins WHERE identity_id=$1',[user.identityId]);
 if (!r.rowCount) throw new Error('Platform admin required');
 return user;
}
async function requireTenantAdmin(client: PoolClient, tenant: string, user: Principal, ownerOnly=false, header?:string) {
 const claims=await verify(bearer(header),cfg.IAM_API_AUDIENCE);
 if(claims.acr!==cfg.IAM_ADMIN_ACR) throw new Error('Owner MFA context required');
 const r = await client.query(`SELECT m.is_owner, r.name FROM memberships m
 LEFT JOIN role_assignments ra ON ra.tenant_id=m.tenant_id AND ra.identity_id=m.identity_id
 LEFT JOIN roles r ON r.id=ra.role_id AND r.tenant_id=m.tenant_id
 JOIN tenants t ON t.id=m.tenant_id
 WHERE m.tenant_id=$1 AND m.identity_id=$2 AND m.status='active' AND t.status='active'`,[tenant,user.identityId]);
 if (!(r.rows.some(x => x.is_owner || (!ownerOnly && x.name==='admin')))) throw new Error('Tenant admin required');
}
async function emit(client: PoolClient, tenant: string, actor: string | null, type: string, target: string | null) {
 const v=await client.query('UPDATE tenants SET authz_version=authz_version+1 WHERE id=$1 RETURNING authz_version',[tenant]);
 const version=Number(v.rows[0].authz_version);
 await client.query('INSERT INTO audit_events(tenant_id,actor_id,event_type,target_id,correlation_id) VALUES($1,$2,$3,$4,$5)',[tenant,actor,type,target,randomUUID()]);
 await client.query('INSERT INTO outbox(aggregate_type,aggregate_id,aggregate_version,event_type,payload) VALUES($1,$2,$3,$4,$5)', ['tenant',tenant,version,type,JSON.stringify({tenant_id:tenant,target_id:target})]);
}
async function transaction<T>(fn: (c: PoolClient)=>Promise<T>, tenantId?: string): Promise<T> {
 const c=await db.connect();
 try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId ?? 'platform']);
  const value=await fn(c);
  await c.query('COMMIT');
  return value;
 }
 catch(e) { await c.query('ROLLBACK'); throw e; }
 finally { c.release(); }
}
function invalid(reply:any,code=400) {return reply.code(code).send({code:code===400?'INVALID_REQUEST':'DENIED'});}
app.get('/healthz',async(req,reply)=>{
 try {
  await db.query('SELECT 1');
  return reply.send({ok:true,status:'healthy',database:'connected'});
 } catch {
  return reply.code(503).send({ok:false,status:'unhealthy',error:'database_unavailable'});
 }
});
app.get('/v1/me/memberships',async(req,reply)=>{
 let user:Principal;
 try{user=await requireUser(req.headers.authorization);}catch{return invalid(reply,401);}
 const r=await transaction(async c=>{
  return c.query(`SELECT m.identity_id,m.tenant_id,m.is_owner,tp.product_id FROM memberships m
  JOIN tenants t ON t.id=m.tenant_id AND t.status='active'
  JOIN tenant_products tp ON tp.tenant_id=m.tenant_id AND tp.status='active'
  WHERE m.identity_id=$1 AND m.status='active'`,[user.identityId]);
 }, 'platform');
 return reply.send({memberships:r.rows});
});
app.post('/v1/tenants',async(req,reply)=>{
 let actor:Principal,body:z.infer<typeof tenantInput>;
 try {
   actor=await requirePlatformAdmin(req.headers.authorization); 
   body=tenantInput.parse(req.body); 
   if(body.owner_issuer!==actor.issuer || body.owner_subject!==actor.sub) throw new Error('Pilot only permits self-owned tenant');
 } catch (err: any) {
   req.log.error({err: err.message}, "Platform Admin Check Failed");
   return invalid(reply,403);
 }
 try {
 const key=z.string().uuid().safeParse(req.headers['idempotency-key']);
 if(!key.success)return invalid(reply,400);
 const digest=createHash('sha256').update(JSON.stringify(body)).digest();
 const result=await transaction(async c=>{
  const claimed=await c.query(`INSERT INTO idempotency_records(actor_id,idempotency_key,request_hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING actor_id`,[actor.identityId,key.data,digest]);
  if(!claimed.rowCount){
   const old=await c.query('SELECT request_hash,response FROM idempotency_records WHERE actor_id=$1 AND idempotency_key=$2 FOR UPDATE',[actor.identityId,key.data]);
   if(!old.rowCount || !old.rows[0].request_hash.equals(digest) || !old.rows[0].response)throw new Error('Idempotency conflict');
   return old.rows[0].response;
  }
  const product=await c.query('SELECT id FROM products WHERE id=$1',[body.initial_product_id]);
  if (!product.rowCount) throw new Error('Unknown product');
  const owner=await c.query(`INSERT INTO identities(issuer,subject) VALUES($1,$2)
    ON CONFLICT(issuer,subject) DO UPDATE SET subject=EXCLUDED.subject RETURNING id`,[body.owner_issuer,body.owner_subject]);
  const t=await c.query('INSERT INTO tenants(slug,name) VALUES($1,$2) RETURNING id,slug,name,status',[body.slug,body.name]);
  const tenant=t.rows[0].id, ownerId=owner.rows[0].id;
  await c.query('INSERT INTO tenant_products(tenant_id,product_id) VALUES($1,$2)',[tenant,body.initial_product_id]);
  await c.query(`INSERT INTO memberships(tenant_id,identity_id,status,is_owner) VALUES($1,$2,'active',true)`,[tenant,ownerId]);
  for(const name of ['owner','admin','viewer']) {
    const r=await c.query('INSERT INTO roles(tenant_id,product_id,name) VALUES($1,$2,$3) RETURNING id',[tenant,body.initial_product_id,name]);
    await c.query(`INSERT INTO role_permissions(tenant_id,product_id,role_id,permission_id)
      SELECT $1,$2,$3,id FROM permissions WHERE product_id=$2 AND ($4<>'viewer' OR risk='routine')`,[tenant,body.initial_product_id,r.rows[0].id,name]);
    if(name==='owner') await c.query('INSERT INTO role_assignments(tenant_id,identity_id,product_id,role_id) VALUES($1,$2,$3,$4)',[tenant,ownerId,body.initial_product_id,r.rows[0].id]);
  }
  await c.query('INSERT INTO audit_events(tenant_id,actor_id,event_type,target_id,correlation_id) VALUES($1,$2,$3,$4,$5)',[tenant,actor.identityId,'tenant.created',tenant,randomUUID()]);
  await c.query('INSERT INTO outbox(aggregate_type,aggregate_id,aggregate_version,event_type,payload) VALUES($1,$2,1,$3,$4)',['tenant',tenant,'tenant.created',JSON.stringify({tenant_id:tenant})]);
  await c.query('UPDATE idempotency_records SET response=$3 WHERE actor_id=$1 AND idempotency_key=$2',[actor.identityId,key.data,JSON.stringify(t.rows[0])]);
  return t.rows[0];
 }); return reply.code(201).send(result);
 }catch(e){req.log.error(e);return invalid(reply,409);}
});
app.post('/v1/tenants/:tenant_id/roles/grant',async(req,reply)=>{
 let actor:Principal, params:z.infer<typeof idPath>, body:z.infer<typeof grantInput>;
 try{actor=await requireUser(req.headers.authorization);params=idPath.parse(req.params);body=grantInput.parse(req.body);}catch{return invalid(reply,403);}
 try{await transaction(async c=>{
  await requireTenantAdmin(c,params.tenant_id,actor,true,req.headers.authorization);
  const role=await c.query('SELECT id,product_id,name FROM roles WHERE id=$1 AND tenant_id=$2',[body.role_id,params.tenant_id]);
  if(!role.rowCount)throw new Error('Role not found');
  if(role.rows[0].name==='owner') throw new Error('Owner transfer not implemented');
  const memberId=await identity(c,body.identity_issuer,body.identity_subject);
  if(!memberId) throw new Error('Invite and verify identity first');
  const m=await c.query("SELECT 1 FROM memberships WHERE tenant_id=$1 AND identity_id=$2 AND status='active'",[params.tenant_id,memberId]);
  if(!m.rowCount)throw new Error('Not active member');
  await c.query('INSERT INTO role_assignments(tenant_id,identity_id,product_id,role_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[params.tenant_id,memberId,role.rows[0].product_id,body.role_id]);
  await emit(c,params.tenant_id,actor.identityId,'role.granted',memberId);
 }, params.tenant_id);return reply.code(204).send();}
 catch(e){req.log.warn(e);return invalid(reply,403);}
});
app.post('/v1/tenants/:tenant_id/memberships/:identity_id/suspend',async(req,reply)=>{
 let actor:Principal,params:z.infer<typeof memberPath>;
 try{actor=await requireUser(req.headers.authorization);params=memberPath.parse(req.params);suspendInput.parse(req.body);}catch{return invalid(reply,403);}
 try{await transaction(async c=>{
  await c.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[params.tenant_id]);
  await requireTenantAdmin(c,params.tenant_id,actor,true,req.headers.authorization);
  const target=await c.query('SELECT is_owner,status FROM memberships WHERE tenant_id=$1 AND identity_id=$2 FOR UPDATE',[params.tenant_id,params.identity_id]);
  if(!target.rowCount || target.rows[0].status!=='active')throw new Error('Unknown active membership');
  if(target.rows[0].is_owner){
   const owners=await c.query("SELECT count(*)::int AS n FROM memberships WHERE tenant_id=$1 AND is_owner AND status='active'",[params.tenant_id]);
   if(owners.rows[0].n<=1)throw new Error('Last owner');
  }
  await c.query("UPDATE memberships SET status='suspended' WHERE tenant_id=$1 AND identity_id=$2",[params.tenant_id,params.identity_id]);
  await emit(c,params.tenant_id,actor.identityId,'membership.suspended',params.identity_id);
 }, params.tenant_id);return reply.code(204).send();}
 catch(e){req.log.warn(e);return invalid(reply,403);}
});
app.post('/v1/decisions/check',async(req,reply)=>{
 const parsed=decisionInput.safeParse(req.body);
 if(!parsed.success)return invalid(reply);
 const body=parsed.data;
 let serviceId:string|null, serviceSubject:string;
 try {
  const service=await verify(bearer(req.headers.authorization),cfg.IAM_API_AUDIENCE);
  serviceId=clientId(service); serviceSubject=service.sub!;
  if(!serviceId) return invalid(reply,403);
 }catch{return invalid(reply,401);}
 try {
  const product=await db.query('SELECT api_audience,service_subject FROM products WHERE id=$1 AND service_client_id=$2',[body.product_id,serviceId]);
  if(!product.rowCount || product.rows[0].service_subject!==serviceSubject)return invalid(reply,403);
  let user;
  try {user=await verify(body.user_access_token,product.rows[0].api_audience);}catch{return invalid(reply,401);}
  const principal=await identity(db,cfg.OIDC_ISSUER,user.sub!);
  if(!principal)return reply.send({allowed:false,reason_code:'NOT_MEMBER',decision_id:randomUUID(),policy_version:null});
  const r=await transaction(async c=>{
   return c.query(`SELECT t.authz_version AS policy_version,t.status AS tenant_status, m.status AS member_status,tp.status AS product_status,
    EXISTS(SELECT 1 FROM role_assignments ra JOIN role_permissions rp
      ON rp.role_id=ra.role_id AND rp.tenant_id=ra.tenant_id AND rp.product_id=ra.product_id
      JOIN permissions p ON p.id=rp.permission_id AND p.product_id=ra.product_id
      WHERE ra.tenant_id=$1 AND ra.identity_id=$2 AND ra.product_id=$3 AND p.name=$4) AS permitted
    FROM tenants t LEFT JOIN memberships m ON m.tenant_id=t.id AND m.identity_id=$2
    LEFT JOIN tenant_products tp ON tp.tenant_id=t.id AND tp.product_id=$3
    WHERE t.id=$1`,[body.tenant_id,principal,body.product_id,body.permission]);
  }, body.tenant_id);
  const allowed=decisionAllowed(r.rows[0]);
  return reply.send({allowed,reason_code:allowed?'GRANTED':'DENIED',decision_id:randomUUID(),policy_version:r.rows[0]?.policy_version ?? null});
 }catch(e){req.log.error({error:'decision dependency failed'});return reply.code(503).send({code:'AUTHORIZATION_UNAVAILABLE'});}
});
app.get('/v1/tenants/:tenant_id/roles',async(req,reply)=>{
 const params=idPath.safeParse(req.params);
 if(!params.success)return invalid(reply);
 let actor:Principal;
 try{actor=await requireUser(req.headers.authorization);}catch{return invalid(reply,401);}
 try {
  const r=await transaction(async c=>{
   const member=await c.query(`SELECT 1 FROM memberships m JOIN tenants t ON t.id=m.tenant_id
   WHERE m.tenant_id=$1 AND m.identity_id=$2 AND m.status='active' AND t.status='active'`,[params.data.tenant_id,actor.identityId]);
   if(!member.rowCount)throw new Error('Not active member');
   return c.query(`SELECT r.id,r.name,r.product_id FROM roles r JOIN tenant_products tp
   ON tp.tenant_id=r.tenant_id AND tp.product_id=r.product_id AND tp.status='active'
   WHERE r.tenant_id=$1 ORDER BY r.name`,[params.data.tenant_id]);
  }, params.data.tenant_id);
  return reply.send({roles:r.rows});
 }catch{return invalid(reply,403);}
});
registerOnboarding(app,db,verify,cfg);
app.addHook('onClose',async()=>{limiter.destroy();await db.end();});
await app.listen({host:'127.0.0.1',port:cfg.IAM_PORT});
