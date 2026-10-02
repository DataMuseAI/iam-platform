import 'dotenv/config';
import { z } from 'zod';
const env = z.object({
  IAM_DATABASE_URL: z.string().url(), OIDC_ISSUER: z.string().url(),
  IAM_API_AUDIENCE: z.string().min(1), IAM_ADMIN_ACR: z.string().min(1), IAM_PORT: z.coerce.number().int().positive().default(4000)
}).parse(process.env);
export const cfg = env;
