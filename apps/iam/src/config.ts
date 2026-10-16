import 'dotenv/config';
import { z } from 'zod';
const env = z.object({
  IAM_DATABASE_URL: z.string().url(),
  OIDC_ISSUER: z.string().url(),
  IAM_API_AUDIENCE: z.string().min(1),
  IAM_ADMIN_ACR: z.string().min(1),
  INVITE_TOKEN_KEY_BASE64: z.string().regex(/^[A-Za-z0-9+/]{43}=$/, 'INVITE_TOKEN_KEY_BASE64 must encode 32 base64 bytes'),
  IAM_PORT: z.coerce.number().int().positive().default(4000)
}).parse(process.env);
export const cfg = env;
