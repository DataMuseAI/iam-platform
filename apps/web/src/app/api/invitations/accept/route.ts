import {NextRequest,NextResponse} from 'next/server';
import {requireMutation,inviteCookie,clearCookie} from '@/lib/session';
import {unseal} from '@/lib/crypto';
import {cfg} from '@/lib/config';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 let session;
 try{session=await requireMutation(req);}catch{return NextResponse.json({code:'DENIED'},{status:403});}
 try{
  const pending=req.cookies.get(inviteCookie)?.value;if(!pending)throw new Error('No pending invitation');
  const token=unseal(pending);
  const api=await fetch(`${cfg.IAM_URL}/v1/invitations/accept`,{method:'POST',headers:{authorization:`Bearer ${session.access}`,'content-type':'application/json'},body:JSON.stringify({token}),cache:'no-store'});
  if(!api.ok)return NextResponse.json({code:'INVITATION_REJECTED'},{status:api.status===503?503:400});
  const data=await api.json();const res=NextResponse.json(data);clearCookie(res,inviteCookie);return res;
 }catch{return NextResponse.json({code:'INVITATION_UNAVAILABLE'},{status:503});}
}
