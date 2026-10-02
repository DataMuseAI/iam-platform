import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {cfg} from './config';
const key=Buffer.from(cfg.BFF_ENCRYPTION_KEY_BASE64,'base64');
if(key.length!==32)throw new Error('BFF_ENCRYPTION_KEY_BASE64 must be 32 bytes');
export const fresh=()=>randomBytes(32).toString('base64url');
export const hash=(value:string)=>createHash('sha256').update(value).digest();
export function equal(a:string,b:string):boolean {const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length && timingSafeEqual(aa,bb);}
export function seal(text:string):string {
 const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);
 const payload=Buffer.concat([c.update(text,'utf8'),c.final()]);
 return Buffer.concat([iv,c.getAuthTag(),payload]).toString('base64url');
}
export function unseal(ciphertext:string):string {
 const v=Buffer.from(ciphertext,'base64url');if(v.length<29)throw new Error('Invalid ciphertext');
 const c=createDecipheriv('aes-256-gcm',key,v.subarray(0,12));c.setAuthTag(v.subarray(12,28));
 return Buffer.concat([c.update(v.subarray(28)),c.final()]).toString('utf8');
}
