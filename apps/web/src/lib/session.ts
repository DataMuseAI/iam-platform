import {db} from './db';
import {fresh,hash,seal,unseal,equal} from './crypto';
import {tokenRequest,validApiToken} from './oidc';
import {cfg,isSecure} from './config';
import type {NextRequest} from 'next/server';
import type {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
export const cookieOptions={httpOnly:true,secure:isSecure,sameSite:'lax' as const,path:'/'};
export const sessionCookie='iam_session',flowCookie='iam_flow',inviteCookie='iam_pending_invite';
export type Session={subject:string;csrf:string;access:string;refresh:string;rawId:string};
export async function getSession(rawId:string|undefined):Promise<Session|null>{
 if(!rawId || !/^[A-Za-z0-9_-]{43}$/.test(rawId))return null;
 const idH=hash(rawId);

 // 1. Fast-Path: Optimistic non-locking read (SEC-IAM-06)
 const initial=await db.query('SELECT * FROM web_sessions WHERE id_hash=$1 AND expires_at>now()',[idH]);
 const row=initial.rows[0];
 if(!row)return null;

 // Fast-Path: Access token still valid (> 30s remaining) - zero lock contention
 if(new Date(row.access_expires_at).getTime()>Date.now()+30_000){
  const access=unseal(row.access_enc);
  const refresh=unseal(row.refresh_enc);
  await validApiToken(access,row.subject);
  return {subject:row.subject,csrf:row.csrf,access,refresh,rawId};
 }

 // 2. Slow-Path: Token refresh required with double-check mutex to prevent race conditions
 const c=await db.connect();
 try{
  await c.query('BEGIN');
  const locked=await c.query('SELECT * FROM web_sessions WHERE id_hash=$1 AND expires_at>now() FOR UPDATE',[idH]);
  const lockedRow=locked.rows[0];
  if(!lockedRow){await c.query('COMMIT');return null;}

  // Double-check: another concurrent request already completed token refresh
  if(new Date(lockedRow.access_expires_at).getTime()>Date.now()+30_000){
   await c.query('COMMIT');
   const access=unseal(lockedRow.access_enc);
   const refresh=unseal(lockedRow.refresh_enc);
   await validApiToken(access,lockedRow.subject);
   return {subject:lockedRow.subject,csrf:lockedRow.csrf,access,refresh,rawId};
  }

  let access=unseal(lockedRow.access_enc),refresh=unseal(lockedRow.refresh_enc);
  try{
   const t=await tokenRequest({grant_type:'refresh_token',refresh_token:refresh});
   await validApiToken(t.access_token,lockedRow.subject);
   access=t.access_token;refresh=t.refresh_token;
   await c.query('UPDATE web_sessions SET access_enc=$2,refresh_enc=$3,access_expires_at=$4 WHERE id_hash=$1',[idH,seal(access),seal(refresh),new Date(Date.now()+t.expires_in*1000)]);
   await c.query('COMMIT');
   return {subject:lockedRow.subject,csrf:lockedRow.csrf,access,refresh,rawId};
  }catch(e){
   await c.query('DELETE FROM web_sessions WHERE id_hash=$1',[idH]);
   await c.query('COMMIT');
   return null;
  }
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function sessionFromCookie(){return getSession((await cookies()).get(sessionCookie)?.value);}
const rateLimitMap=new Map<string,{count:number;resetAt:number}>();
export function checkRateLimit(req:NextRequest,max=60,windowMs=60_000):void{
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
 const now=Date.now();
 const entry=rateLimitMap.get(ip);
 if(!entry || now>entry.resetAt){rateLimitMap.set(ip,{count:1,resetAt:now+windowMs});return;}
 if(entry.count>=max)throw new Error('Rate limit exceeded');
 entry.count+=1;
}
export function checkOrigin(req:NextRequest){
 const expected=new URL(cfg.WEB_BASE_URL).origin;
 if(req.headers.get('origin')!==expected)throw new Error('Invalid origin');
}
export async function requireMutation(req:NextRequest){
 checkRateLimit(req,60);
 checkOrigin(req);
 const session=await getSession(req.cookies.get(sessionCookie)?.value);
 if(!session || !equal(session.csrf,req.headers.get('x-csrf-token')??''))throw new Error('Unauthorized mutation');
 return session;
}
export function clearCookie(res:NextResponse,name:string){res.cookies.set(name,'',{...cookieOptions,maxAge:0});}
