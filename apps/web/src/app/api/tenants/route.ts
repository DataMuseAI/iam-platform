import {NextRequest,NextResponse} from 'next/server';
import {getSession,sessionCookie} from '@/lib/session';
import {cfg} from '@/lib/config';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 const session=await getSession(req.cookies.get(sessionCookie)?.value);
 if(!session)return NextResponse.json({code:'UNAUTHENTICATED'},{status:401});
 try{
  const r=await fetch(`${cfg.IAM_URL}/v1/me/memberships`,{headers:{authorization:`Bearer ${session.access}`},cache:'no-store'});
  if(!r.ok)return NextResponse.json({code:'IAM_UNAVAILABLE'},{status:503});
  return NextResponse.json(await r.json(),{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({code:'IAM_UNAVAILABLE'},{status:503});}
}
