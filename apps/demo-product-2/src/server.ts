import Fastify from 'fastify';
import {Pool} from 'pg';
import 'dotenv/config';
import {z} from 'zod';
import {bearer,tokenVerifier} from '../../../packages/security/src/tokens.js';
import {sameTenant} from '../../../packages/security/src/policy.js';
import {MemoryRateLimiter} from '../../../packages/security/src/rate-limit.js';

const env=z.object({DEMO_2_DATABASE_URL:z.string().url(),OIDC_ISSUER:z.string().url(),DEMO_2_API_AUDIENCE:z.string().min(1),DEMO_2_SERVICE_CLIENT_ID:z.string().min(1),DEMO_2_SERVICE_CLIENT_SECRET:z.string().min(1),IAM_URL:z.string().url(),DEMO_2_PRODUCT_ID:z.string().uuid(),DEMO_2_PORT:z.coerce.number().int().positive().default(4002)}).parse(process.env);
const app=Fastify({logger:{redact:['req.headers.authorization']},bodyLimit:16000});
const db=new Pool({connectionString:env.DEMO_2_DATABASE_URL});
const verify=tokenVerifier(env.OIDC_ISSUER);
const limiter=new MemoryRateLimiter(60_000, 120);

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

let serviceToken=''; let tokenExpires=0;
async function credential():Promise<string> {
 if(Date.now()<tokenExpires-15000 && serviceToken)return serviceToken;
 const response=await fetch(`${env.OIDC_ISSUER}/protocol/openid-connect/token`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:env.DEMO_2_SERVICE_CLIENT_ID,client_secret:env.DEMO_2_SERVICE_CLIENT_SECRET})});
 if(!response.ok)throw new Error('Service token unavailable');
 const body=await response.json() as {access_token:string;expires_in:number};
 serviceToken=body.access_token; tokenExpires=Date.now()+body.expires_in*1000;
 return serviceToken;
}
app.get('/healthz',async(req,reply)=>{
 try {
  await db.query('SELECT 1');
  return reply.send({ok:true,status:'healthy',database:'connected'});
 } catch {
  return reply.code(503).send({ok:false,status:'unhealthy',error:'database_unavailable'});
 }
});
app.get('/tenants/:tenant_id/widgets/:widget_id',async(req,reply)=>{
 const parsed=z.object({tenant_id:z.string().uuid(),widget_id:z.string().uuid()}).safeParse(req.params);
 if(!parsed.success)return reply.code(400).send({code:'INVALID_REQUEST'});
 let userToken:string;
 try { userToken=bearer(req.headers.authorization); await verify(userToken,env.DEMO_2_API_AUDIENCE); }
 catch {return reply.code(401).send({code:'UNAUTHENTICATED'});}
 try {
  const {tenant_id,widget_id}=parsed.data;
  // Product database is authoritative for resource ownership; never lookup by ID alone.
  const c=await db.connect();
  let widget;
  try{
   await c.query('BEGIN');
   await c.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenant_id]);
   const result=await c.query('SELECT id,tenant_id,name FROM widgets WHERE tenant_id=$1 AND id=$2',[tenant_id,widget_id]);
   await c.query('COMMIT');
   widget=result.rows[0];
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  if(!widget || !sameTenant(tenant_id,widget.tenant_id))return reply.code(404).send({code:'NOT_FOUND'});
  const iam=await fetch(`${env.IAM_URL}/v1/decisions/check`,{
   method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${await credential()}`},
   body:JSON.stringify({user_access_token:userToken,tenant_id,product_id:env.DEMO_2_PRODUCT_ID,permission:'demo:widget:read'})
  });
  if(!iam.ok)return reply.code(503).send({code:'AUTHORIZATION_UNAVAILABLE'});
  const decision=await iam.json() as {allowed:boolean};
  if(!decision.allowed)return reply.code(404).send({code:'NOT_FOUND'});
  return reply.send({id:widget.id,name:widget.name});
 } catch {return reply.code(503).send({code:'AUTHORIZATION_UNAVAILABLE'});}
});
app.addHook('onClose',async()=>{limiter.destroy();await db.end();});
await app.listen({host:'127.0.0.1',port:env.DEMO_2_PORT});
