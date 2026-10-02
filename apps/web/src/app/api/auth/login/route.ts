import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {fresh,hash,seal} from '@/lib/crypto';
import {discovery,challenge} from '@/lib/oidc';
import {cfg} from '@/lib/config';
import {cookieOptions,flowCookie} from '@/lib/session';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 try{
  const requested=req.nextUrl.searchParams.get('returnTo');
  const returnTo=requested==='/accept-invite'?'/accept-invite':'/dashboard';
  const state=fresh(),browser=fresh(),verifier=fresh(),nonce=fresh();
  await db.query(`INSERT INTO oauth_flows(state_hash,browser_hash,verifier_enc,nonce,return_to,expires_at)
   VALUES($1,$2,$3,$4,$5,now()+interval '5 minutes')`,[hash(state),hash(browser),seal(verifier),nonce,returnTo]);
  const m=await discovery(),url=new URL(m.authorization_endpoint);
  url.search=new URLSearchParams({response_type:'code',client_id:cfg.OIDC_CLIENT_ID,redirect_uri:`${cfg.WEB_BASE_URL}/api/auth/callback`,scope:'openid profile email',state,nonce,code_challenge:challenge(verifier),code_challenge_method:'S256'}).toString();
  const res=NextResponse.redirect(url);
  res.cookies.set(flowCookie,browser,{...cookieOptions,maxAge:300});
  return res;
 }catch{return NextResponse.json({code:'LOGIN_UNAVAILABLE'},{status:503});}
}
