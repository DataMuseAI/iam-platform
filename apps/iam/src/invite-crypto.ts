import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
export function inviteKey(raw: string | undefined): Buffer {
 if(!raw || !/^[A-Za-z0-9+/]{43}=$/.test(raw))throw new Error('INVITE_TOKEN_KEY_BASE64 must encode 32 random bytes');
 const key=Buffer.from(raw,'base64');
 if(key.length!==32)throw new Error('Invite key must be 32 bytes');
 return key;
}
export function newInvite(key:Buffer) {
 const token=randomBytes(32).toString('base64url');
 const hash=createHash('sha256').update(token).digest();
 const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key,iv);
 const ciphertext=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
 return {token,hash,iv,ciphertext,tag:cipher.getAuthTag()};
}
export function decryptInvite(key:Buffer,iv:Buffer,ciphertext:Buffer,tag:Buffer):string {
 const dec=createDecipheriv('aes-256-gcm',key,iv);dec.setAuthTag(tag);
 return Buffer.concat([dec.update(ciphertext),dec.final()]).toString('utf8');
}
export function inviteHash(token:string):Buffer {return createHash('sha256').update(token).digest();}
export function equalInviteToken(token:string, stored:Buffer):boolean {
 const hash=inviteHash(token);return hash.length===stored.length && timingSafeEqual(hash,stored);
}
export function normalizedEmail(value:string):string {return value.trim().toLowerCase();}
