import { describe, it, expect, vi } from 'vitest';
import { randomBytes } from 'node:crypto';

process.env.WEB_DATABASE_URL = 'postgres://web_dev:web_dev_only@localhost:5435/web_dev';
process.env.BFF_ENCRYPTION_KEY_BASE64 = randomBytes(32).toString('base64');
process.env.OIDC_ISSUER = 'http://localhost:8080/realms/saas-dev';
process.env.OIDC_CLIENT_ID = 'web-bff';
process.env.OIDC_CLIENT_SECRET = 'not-for-real-use';
process.env.IAM_API_AUDIENCE = 'iam-api';
process.env.IAM_URL = 'http://localhost:4000';
process.env.WEB_BASE_URL = 'http://localhost:3000';

describe('BFF session management & lock contention defense (SEC-IAM-06)', () => {
  it('rejects invalid or malformed session IDs instantly without querying database', async () => {
    const { getSession } = await import('../src/lib/session');
    expect(await getSession(undefined)).toBeNull();
    expect(await getSession('')).toBeNull();
    expect(await getSession('short')).toBeNull();
    expect(await getSession('contains-special-chars!@#$%^&*()_+~`|}{[]:;?><,./')).toBeNull();
  });

  it('enforces strict origin verification for mutations (CSRF defense)', async () => {
    const { checkOrigin } = await import('../src/lib/session');
    const validReq = {
      headers: new Headers({ origin: 'http://localhost:3000' }),
    } as any;
    expect(() => checkOrigin(validReq)).not.toThrow();

    const invalidReq = {
      headers: new Headers({ origin: 'http://evil-attacker.com' }),
    } as any;
    expect(() => checkOrigin(invalidReq)).toThrow(/Invalid origin/i);

    const missingOrigin = {
      headers: new Headers(),
    } as any;
    expect(() => checkOrigin(missingOrigin)).toThrow(/Invalid origin/i);
  });
});
