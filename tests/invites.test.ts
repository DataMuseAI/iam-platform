import {describe,it,expect} from 'vitest';
import {randomBytes} from 'node:crypto';
import {
  newInvite,
  inviteHash,
  decryptInvite,
  equalInviteToken,
  normalizedEmail,
  inviteKey,
  assertHighEntropyKey,
  generateSecureKey
} from '../apps/iam/src/invite-crypto.js';

describe('invitation token crypto & entropy gates', () => {
  it('is random, encrypted for dispatch, hashed for lookup', () => {
    const key = randomBytes(32);
    const a = newInvite(key);
    const b = newInvite(key);
    expect(a.token).not.toBe(b.token);
    expect(equalInviteToken(a.token, a.hash)).toBe(true);
    expect(equalInviteToken(b.token, a.hash)).toBe(false);
    expect(decryptInvite(key, a.iv, a.ciphertext, a.tag)).toBe(a.token);
    expect(inviteHash(a.token)).toEqual(a.hash);
    expect(() => decryptInvite(randomBytes(32), a.iv, a.ciphertext, a.tag)).toThrow();
  });

  it('normalizes for match only', () => {
    expect(normalizedEmail(' A@Example.COM ')).toBe('a@example.com');
  });

  it('rejects trivial, predictable, and low-entropy keys (SEC-IAM-01)', () => {
    // Trivial sequential ASCII key (previously hardcoded)
    const sequentialWeak = Buffer.from('12345678901234567890123456789012', 'ascii');
    expect(() => assertHighEntropyKey(sequentialWeak)).toThrow(/weak|entropy/i);
    expect(() => inviteKey(sequentialWeak.toString('base64'))).toThrow(/weak|entropy/i);

    // Known denylisted pattern with 32 unique bytes
    const denylisted = Buffer.from('abcdefghijklmnopqrstuvwxyz012345', 'ascii');
    expect(() => assertHighEntropyKey(denylisted)).toThrow(/weak or predictable/i);

    // Repeated byte patterns (low entropy)
    const repeating = Buffer.alloc(32, 0x41); // 'AAAAAAAAAAAAAAAA...'
    expect(() => assertHighEntropyKey(repeating)).toThrow(/entropy/i);

    // Short / long key lengths
    expect(() => assertHighEntropyKey(Buffer.alloc(16))).toThrow(/32 bytes/i);
    expect(() => assertHighEntropyKey(Buffer.alloc(64))).toThrow(/32 bytes/i);

    // Non-base64 format
    expect(() => inviteKey('invalid-base64!')).toThrow(/must encode 32 random bytes/i);
  });

  it('accepts genuine high-entropy keys and validates generator', () => {
    const generated = generateSecureKey();
    expect(typeof generated).toBe('string');
    expect(generated.length).toBe(44);

    const parsed = inviteKey(generated);
    expect(parsed).toBeInstanceOf(Buffer);
    expect(parsed.length).toBe(32);
    expect(() => assertHighEntropyKey(parsed)).not.toThrow();
  });
});
