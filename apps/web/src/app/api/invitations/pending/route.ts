import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {checkOrigin,checkRateLimit,cookieOptions,inviteCookie} from '@/lib/session';
import {seal} from '@/lib/crypto';
export const runtime='nodejs';
const input=z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict();
export async function POST(req:NextRequest){
 try{checkRateLimit(req,20);checkOrigin(req);const body=input.parse(await req.json());
  const res=NextResponse.json({stored:true},{headers:{'Cache-Control':'no-store'}});
  res.cookies.set(inviteCookie,seal(body.token),{...cookieOptions,maxAge:600});return res;
 }catch{return NextResponse.json({code:'INVALID_INVITATION'},{status:400});}
}
