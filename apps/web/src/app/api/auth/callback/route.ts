import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {fresh,hash,seal,unseal} from '@/lib/crypto';
import {validApiToken,validIdToken,tokenRequest} from '@/lib/oidc';
import {cfg} from '@/lib/config';
import {cookieOptions,sessionCookie,flowCookie,clearCookie} from '@/lib/session';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 const code=req.nextUrl.searchParams.get('code'),state=req.nextUrl.searchParams.get('state'),browser=req.cookies.get(flowCookie)?.value;
 if(!code || !state || !browser || !/^[A-Za-z0-9_-]{43}$/.test(state))return NextResponse.redirect(new URL('/login-error',cfg.WEB_BASE_URL));
 const c=await db.connect();
 try{
  await c.query('BEGIN');
  const q=await c.query('DELETE FROM oauth_flows WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>now() RETURNING *',[hash(state),hash(browser)]);
  if(!q.rowCount)throw new Error('Invalid flow');
  const row=q.rows[0];
  const t=await tokenRequest({grant_type:'authorization_code',code,redirect_uri:`${cfg.WEB_BASE_URL}/api/auth/callback`,code_verifier:unseal(row.verifier_enc)});
  if(!t.id_token)throw new Error('Missing ID token');
  const id=await validIdToken(t.id_token,row.nonce);
  await validApiToken(t.access_token,id.sub);
  const rawId=fresh(),csrf=fresh();
  await c.query(`INSERT INTO web_sessions(id_hash,subject,csrf,access_enc,refresh_enc,access_expires_at,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,now()+interval '8 hours')`,[hash(rawId),id.sub,csrf,seal(t.access_token),seal(t.refresh_token),new Date(Date.now()+t.expires_in*1000)]);
  await c.query('COMMIT');
  const res=NextResponse.redirect(new URL(row.return_to,cfg.WEB_BASE_URL));
  res.cookies.set(sessionCookie,rawId,{...cookieOptions,maxAge:8*3600});clearCookie(res,flowCookie);
  return res;
 }catch{await c.query('ROLLBACK');const res=NextResponse.redirect(new URL('/login-error',cfg.WEB_BASE_URL));clearCookie(res,flowCookie);return res;}
 finally{c.release();}
}
