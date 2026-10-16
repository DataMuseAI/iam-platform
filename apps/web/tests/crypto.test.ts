import {describe,it,expect,beforeAll} from 'vitest';
import {randomBytes} from 'node:crypto';
process.env.WEB_DATABASE_URL='postgres://web_dev:web_dev_only@localhost:5435/web_dev';
process.env.BFF_ENCRYPTION_KEY_BASE64=randomBytes(32).toString('base64');
process.env.OIDC_ISSUER='http://localhost:8080/realms/saas-dev';
process.env.OIDC_CLIENT_ID='web-bff';
process.env.OIDC_CLIENT_SECRET='not-for-real-use';
process.env.IAM_API_AUDIENCE='iam-api';
process.env.IAM_URL='http://localhost:4000';
process.env.WEB_BASE_URL='http://localhost:3000';
describe('server secrets & BFF key entropy gates', () => {
  it('seals tokens and refuses corrupted ciphertext', async () => {
    const m = await import('../src/lib/crypto');
    const enc = m.seal('not-for-browser');
    expect(enc).not.toContain('not-for-browser');
    expect(m.unseal(enc)).toBe('not-for-browser');
    expect(() => m.unseal(enc.slice(0, -2) + 'aa')).toThrow();
    expect(m.equal(m.fresh(), m.fresh())).toBe(false);
  });

  it('rejects trivial, predictable, and low-entropy BFF encryption keys (SEC-IAM-01)', async () => {
    const m = await import('../src/lib/crypto');
    // Weak sequential dev key
    const sequentialWeak = Buffer.from('12345678901234567890123456789012', 'ascii');
    expect(() => m.assertHighEntropyKey(sequentialWeak, 'BFF_ENCRYPTION_KEY_BASE64')).toThrow(/weak|entropy/i);
    expect(() => m.validateBffKey(sequentialWeak.toString('base64'))).toThrow(/weak|entropy/i);

    // Known denylisted pattern with 32 unique bytes
    const denylisted = Buffer.from('abcdefghijklmnopqrstuvwxyz012345', 'ascii');
    expect(() => m.assertHighEntropyKey(denylisted, 'BFF_ENCRYPTION_KEY_BASE64')).toThrow(/weak or predictable/i);

    // Repeated byte patterns
    const repeating = Buffer.alloc(32, 0x42);
    expect(() => m.assertHighEntropyKey(repeating, 'BFF_ENCRYPTION_KEY_BASE64')).toThrow(/entropy/i);

    // Invalid lengths
    expect(() => m.assertHighEntropyKey(Buffer.alloc(16), 'BFF_ENCRYPTION_KEY_BASE64')).toThrow(/32 bytes/i);

    // Strong key passes
    const strong = randomBytes(32).toString('base64');
    expect(m.validateBffKey(strong)).toBeInstanceOf(Buffer);
  });
});
