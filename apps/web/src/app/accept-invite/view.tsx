'use client';
import {useEffect,useState} from 'react';
export default function AcceptView(){
 const [csrf,setCsrf]=useState(''),[message,setMessage]=useState('Loading invitation...');
 useEffect(()=>{
  const token=new URLSearchParams(location.hash.replace(/^#/,'' )).get('token');
  history.replaceState(null,'',location.pathname);
  const save=token?fetch('/api/invitations/pending',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})}):Promise.resolve(null);
  save.then(r=>{if(r && !r.ok)throw new Error('Invalid link');return fetch('/api/session',{cache:'no-store'});})
   .then(r=>r.json()).then(s=>{if(s.authenticated){setCsrf(s.csrf);setMessage('Ready to accept invitation');}else setMessage('Sign in using the invited verified email address');})
   .catch(()=>setMessage('Invalid or unavailable invitation'));
 },[]);
 async function accept(){const r=await fetch('/api/invitations/accept',{method:'POST',headers:{'x-csrf-token':csrf}});setMessage(r.ok?'Invitation accepted. Open the dashboard.':'Invitation expired, mismatched or service unavailable.');}
 return <main><h1>Accept invitation</h1><p role="status">{message}</p>{csrf?<button onClick={accept}>Accept</button>:<a href="/api/auth/login?returnTo=/accept-invite">Sign in</a>}<p><a href="/dashboard">Dashboard</a></p></main>;
}
