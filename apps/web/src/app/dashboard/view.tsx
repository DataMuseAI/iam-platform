'use client';
import {useEffect,useState} from 'react';
type Membership={identity_id:string;tenant_id:string;is_owner:boolean;product_id:string};
type Role={id:string;name:string;product_id:string};
export default function Dashboard(){
 const [csrf,setCsrf]=useState(''),[members,setMembers]=useState<Membership[]>([]),[roles,setRoles]=useState<Role[]>([]),[tenant,setTenant]=useState(''),[email,setEmail]=useState(''),[role,setRole]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{fetch('/api/session',{cache:'no-store'}).then(r=>r.json()).then(s=>{if(s.authenticated){setCsrf(s.csrf);fetch('/api/tenants',{cache:'no-store'}).then(r=>r.json()).then(x=>setMembers(x.memberships??[]));}}).catch(()=>setMessage('Service unavailable'));},[]);
 useEffect(()=>{if(!tenant)return;fetch(`/api/roles?tenant_id=${encodeURIComponent(tenant)}`,{cache:'no-store'}).then(r=>r.json()).then(x=>setRoles(x.roles??[])).catch(()=>setRoles([]));},[tenant]);
 async function invite(e:React.FormEvent){e.preventDefault();const r=await fetch('/api/invitations/create',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({tenant_id:tenant,email,role_id:role})});setMessage(r.ok?'Invitation queued':'Invitation denied or service unavailable');}
 async function logout(){await fetch('/api/auth/logout',{method:'POST',headers:{'x-csrf-token':csrf}});location.href='/dashboard';}
 if(!csrf)return <main><h1>IAM dashboard</h1><a href="/api/auth/login">Sign in</a><p>{message}</p></main>;
 return <main><h1>IAM dashboard</h1><button onClick={logout}>Sign out</button><p>Active tenant/product memberships: {members.length}</p>
 <label>Tenant <select value={tenant} onChange={e=>{setTenant(e.target.value);setRole('');}}><option value="">Choose</option>{[...new Map(members.filter(m=>m.is_owner).map(m=>[m.tenant_id,m])).values()].map(m=><option key={m.tenant_id} value={m.tenant_id}>{m.tenant_id}</option>)}</select></label>
 <form onSubmit={invite}><h2>Invite member</h2><label>Email <input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><br/><label>Role <select required value={role} onChange={e=>setRole(e.target.value)}><option value="">Choose</option>{roles.filter(r=>r.name!=='owner').map(r=><option key={r.id} value={r.id}>{r.name} ({r.product_id})</option>)}</select></label><br/><button disabled={!tenant||!role}>Send invitation</button></form><p role="status">{message}</p></main>;
}
