import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {hash} from '@/lib/crypto';
import {discovery} from '@/lib/oidc';
import {cfg} from '@/lib/config';
import {requireMutation,sessionCookie,clearCookie,inviteCookie} from '@/lib/session';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 let session;
 try{session=await requireMutation(req);}catch{return NextResponse.json({code:'DENIED'},{status:403});}
 await db.query('DELETE FROM web_sessions WHERE id_hash=$1',[hash(session.rawId)]);
 try{
  const logout=(await discovery()).end_session_endpoint;
  if(logout)await fetch(logout,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({client_id:cfg.OIDC_CLIENT_ID,client_secret:cfg.OIDC_CLIENT_SECRET,refresh_token:session.refresh})});
 }catch{} // local session is invalid regardless; IdP failure requires security alert in production.
 const res=NextResponse.json({ok:true});clearCookie(res,sessionCookie);clearCookie(res,inviteCookie);return res;
}
