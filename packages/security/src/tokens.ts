import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export function tokenVerifier(issuer: string) {
  const normalized = issuer.replace(/\/$/, '');
  // Pinned Keycloak endpoint. Cross-check issuer/JWKS against OIDC discovery in G0.
  const keys = createRemoteJWKSet(new URL(`${normalized}/protocol/openid-connect/certs`));
  return async (token: string, audience: string): Promise<JWTPayload> => {
    const { payload } = await jwtVerify(token, keys, {
      issuer: normalized, audience, algorithms: ['RS256'], clockTolerance: '5s'
    });
    if (!payload.sub || typeof payload.sub !== 'string') throw new Error('Missing subject');
    return payload;
  };
}
export function bearer(value: string | undefined): string {
  const match = value?.match(/^Bearer ([A-Za-z0-9._~+/-]+=*)$/);
  if (!match) throw new Error('Bearer token required');
  return match[1];
}
export function clientId(payload: JWTPayload): string | null {
  const value = payload.azp ?? payload.client_id;
  return typeof value === 'string' ? value : null;
}
