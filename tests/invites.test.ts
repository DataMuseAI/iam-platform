import {describe,it,expect} from 'vitest';
import {randomBytes} from 'node:crypto';
import {newInvite,inviteHash,decryptInvite,equalInviteToken,normalizedEmail} from '../apps/iam/src/invite-crypto.js';
describe('invitation token',()=>{
 it('is random, encrypted for dispatch, hashed for lookup',()=>{
  const key=randomBytes(32),a=newInvite(key),b=newInvite(key);
  expect(a.token).not.toBe(b.token);
  expect(equalInviteToken(a.token,a.hash)).toBe(true);
  expect(equalInviteToken(b.token,a.hash)).toBe(false);
  expect(decryptInvite(key,a.iv,a.ciphertext,a.tag)).toBe(a.token);
  expect(inviteHash(a.token)).toEqual(a.hash);
  expect(()=>decryptInvite(randomBytes(32),a.iv,a.ciphertext,a.tag)).toThrow();
 });
 it('normalizes for match only',()=>{expect(normalizedEmail(' A@Example.COM ')).toBe('a@example.com');});
});
