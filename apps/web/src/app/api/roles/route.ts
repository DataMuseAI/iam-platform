import {NextRequest,NextResponse} from 'next/server';
import {getSession,sessionCookie} from '@/lib/session';
import {cfg} from '@/lib/config';
import {z} from 'zod';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 const tenant=z.string().uuid().safeParse(req.nextUrl.searchParams.get('tenant_id'));
 if(!tenant.success)return NextResponse.json({code:'INVALID_REQUEST'},{status:400});
 const session=await getSession(req.cookies.get(sessionCookie)?.value);
 if(!session)return NextResponse.json({code:'UNAUTHENTICATED'},{status:401});
 try{
  const r=await fetch(`${cfg.IAM_URL}/v1/tenants/${tenant.data}/roles`,{headers:{authorization:`Bearer ${session.access}`},cache:'no-store'});
  if(!r.ok)return NextResponse.json({code:'IAM_UNAVAILABLE'},{status:r.status===403?403:503});
  return NextResponse.json(await r.json(),{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({code:'IAM_UNAVAILABLE'},{status:503});}
}
