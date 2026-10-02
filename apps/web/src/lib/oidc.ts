import {createRemoteJWKSet,jwtVerify,type JWTPayload} from 'jose';
import {createHash} from 'node:crypto';
import {cfg} from './config';
export type Discovery={issuer:string;authorization_endpoint:string;token_endpoint:string;jwks_uri:string;end_session_endpoint?:string};
let meta:Discovery|undefined;let keys:ReturnType<typeof createRemoteJWKSet>|undefined;
export async function discovery():Promise<Discovery>{
 if(meta)return meta;
 const r=await fetch(`${cfg.OIDC_ISSUER.replace(/\/$/,'')}/.well-known/openid-configuration`,{cache:'no-store'});
 if(!r.ok)throw new Error('OIDC discovery unavailable');
 const v=await r.json() as Discovery;
 if(v.issuer!==cfg.OIDC_ISSUER || !v.authorization_endpoint || !v.token_endpoint || !v.jwks_uri)throw new Error('OIDC issuer mismatch');
 meta=v;return v;
}
async function jwks(){if(!keys)keys=createRemoteJWKSet(new URL((await discovery()).jwks_uri));return keys;}
export async function validIdToken(token:string,nonce:string):Promise<JWTPayload>{
 const {payload}=await jwtVerify(token,await jwks(),{issuer:cfg.OIDC_ISSUER,audience:cfg.OIDC_CLIENT_ID,algorithms:['RS256'],clockTolerance:'5s'});
 if(!payload.sub || payload.nonce!==nonce)throw new Error('Invalid ID token');return payload;
}
export async function validApiToken(token:string,subject?:string):Promise<JWTPayload>{
 const {payload}=await jwtVerify(token,await jwks(),{issuer:cfg.OIDC_ISSUER,audience:cfg.IAM_API_AUDIENCE,algorithms:['RS256'],clockTolerance:'5s'});
 if(!payload.sub || (subject && payload.sub!==subject))throw new Error('Wrong access token subject');return payload;
}
export async function tokenRequest(fields:Record<string,string>){
 const endpoint=(await discovery()).token_endpoint;
 const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:cfg.OIDC_CLIENT_ID,client_secret:cfg.OIDC_CLIENT_SECRET,...fields}),cache:'no-store'});
 if(!r.ok)throw new Error('Token exchange failed');
 const t=await r.json() as {access_token:string;refresh_token:string;id_token?:string;expires_in:number};
 if(!t.access_token || !t.refresh_token || !Number.isFinite(t.expires_in))throw new Error('Invalid token response');return t;
}
export function challenge(verifier:string){return createHash('sha256').update(verifier).digest('base64url');}
