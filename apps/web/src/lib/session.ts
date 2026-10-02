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
 const c=await db.connect();
 try{
  await c.query('BEGIN');
  const q=await c.query('SELECT * FROM web_sessions WHERE id_hash=$1 AND expires_at>now() FOR UPDATE',[hash(rawId)]);
  const row=q.rows[0];if(!row){await c.query('COMMIT');return null;}
  let access=unseal(row.access_enc),refresh=unseal(row.refresh_enc);
  if(new Date(row.access_expires_at).getTime()<=Date.now()+30_000){
   try{
    const t=await tokenRequest({grant_type:'refresh_token',refresh_token:refresh});
    await validApiToken(t.access_token,row.subject);
    access=t.access_token;refresh=t.refresh_token;
    await c.query('UPDATE web_sessions SET access_enc=$2,refresh_enc=$3,access_expires_at=$4 WHERE id_hash=$1',[hash(rawId),seal(access),seal(refresh),new Date(Date.now()+t.expires_in*1000)]);
   }catch(e){await c.query('DELETE FROM web_sessions WHERE id_hash=$1',[hash(rawId)]);await c.query('COMMIT');return null;}
  }else await validApiToken(access,row.subject);
  await c.query('COMMIT');return {subject:row.subject,csrf:row.csrf,access,refresh,rawId};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function sessionFromCookie(){return getSession((await cookies()).get(sessionCookie)?.value);}
export function checkOrigin(req:NextRequest){
 const expected=new URL(cfg.WEB_BASE_URL).origin;
 if(req.headers.get('origin')!==expected)throw new Error('Invalid origin');
}
export async function requireMutation(req:NextRequest){
 checkOrigin(req);
 const session=await getSession(req.cookies.get(sessionCookie)?.value);
 if(!session || !equal(session.csrf,req.headers.get('x-csrf-token')??''))throw new Error('Unauthorized mutation');
 return session;
}
export function clearCookie(res:NextResponse,name:string){res.cookies.set(name,'',{...cookieOptions,maxAge:0});}
