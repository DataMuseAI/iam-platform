import {z} from 'zod';
export const cfg=z.object({WEB_DATABASE_URL:z.string().url(),BFF_ENCRYPTION_KEY_BASE64:z.string().min(40),OIDC_ISSUER:z.string().url(),OIDC_CLIENT_ID:z.string().min(1),OIDC_CLIENT_SECRET:z.string().min(1),IAM_API_AUDIENCE:z.string().min(1),IAM_URL:z.string().url(),WEB_BASE_URL:z.string().url()}).parse(process.env);
const url = new URL(cfg.WEB_BASE_URL);
export const isSecure = url.protocol === 'https:';
const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
if (process.env.NODE_ENV === 'production' && !isSecure && !isLocalhost && process.env.NEXT_PHASE !== 'phase-production-build') {
  throw new Error('Production BFF requires HTTPS');
}
