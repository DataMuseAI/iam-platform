import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {cfg} from './config';
export function assertHighEntropyKey(key: Buffer, keyName = 'Key'): void {
  if (key.length !== 32) {
    throw new Error(`${keyName} must be exactly 32 bytes`);
  }
  const counts = new Map<number, number>();
  for (const b of key) counts.set(b, (counts.get(b) || 0) + 1);
  if (counts.size < 18) {
    throw new Error(`${keyName} lacks sufficient entropy (too few unique bytes: ${counts.size}/32). Weak or repetitive keys are prohibited.`);
  }
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / 32;
    entropy -= p * Math.log2(p);
  }
  if (entropy < 3.8) {
    throw new Error(`${keyName} lacks sufficient Shannon entropy (${entropy.toFixed(2)} < 3.80). Use crypto.randomBytes(32).toString('base64').`);
  }
  const ascii = key.toString('ascii');
  const hex = key.toString('hex');
  const denylist = [
    '12345678901234567890123456789012',
    '0123456789abcdef0123456789abcdef',
    '00000000000000000000000000000000',
    'abcdefghijklmnopqrstuvwxyz012345',
  ];
  if (denylist.includes(ascii) || denylist.includes(hex)) {
    throw new Error(`${keyName} matches known weak or predictable development pattern.`);
  }
}

export function validateBffKey(raw: string): Buffer {
  if (!raw || !/^[A-Za-z0-9+/]{43}=$/.test(raw)) {
    throw new Error('BFF_ENCRYPTION_KEY_BASE64 must be 32 valid base64-encoded bytes');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('BFF_ENCRYPTION_KEY_BASE64 must be 32 bytes');
  assertHighEntropyKey(key, 'BFF_ENCRYPTION_KEY_BASE64');
  return key;
}

const key = validateBffKey(cfg.BFF_ENCRYPTION_KEY_BASE64);
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
