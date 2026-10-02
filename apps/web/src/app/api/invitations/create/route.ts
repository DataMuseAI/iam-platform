import {NextRequest,NextResponse} from 'next/server';
import {requireMutation} from '@/lib/session';
import {cfg} from '@/lib/config';
import {z} from 'zod';
export const runtime='nodejs';
const input=z.object({tenant_id:z.string().uuid(),email:z.string().email().max(320),role_id:z.string().uuid()}).strict();
export async function POST(req:NextRequest){
 let session;
 try{session=await requireMutation(req);}catch{return NextResponse.json({code:'DENIED'},{status:403});}
 let body;
 try{body=input.parse(await req.json());}catch{return NextResponse.json({code:'INVALID_REQUEST'},{status:400});}
 try{
  const r=await fetch(`${cfg.IAM_URL}/v1/tenants/${body.tenant_id}/invitations`,{method:'POST',headers:{authorization:`Bearer ${session.access}`,'content-type':'application/json'},body:JSON.stringify({email:body.email,role_id:body.role_id}),cache:'no-store'});
  return NextResponse.json(r.ok?{ok:true}:{code:'INVITE_REJECTED'},{status:r.ok?202:r.status===503?503:403,headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({code:'IAM_UNAVAILABLE'},{status:503});}
}
