import {NextRequest,NextResponse} from 'next/server';
import {getSession,sessionCookie} from '@/lib/session';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 try{const s=await getSession(req.cookies.get(sessionCookie)?.value);
  const res=NextResponse.json(s?{authenticated:true,csrf:s.csrf,subject:s.subject}:{authenticated:false});
  res.headers.set('Cache-Control','no-store');return res;
 }catch{return NextResponse.json({authenticated:false},{status:503,headers:{'Cache-Control':'no-store'}});}
}
