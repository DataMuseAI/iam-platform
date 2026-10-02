# Next increments to complete enterprise baseline
## Increment 0: verify this repository
- In a network-enabled environment, `npm install` and commit lockfile. Run `npm run typecheck && npm test`, Docker compose migrations and Keycloak manual setup. Fix issues uncovered; verify SQL under PostgreSQL 17. Pin Docker images by digest. No claim of tests passing before execution.

## Increment 1: safe user onboarding and auth UI
- Next.js BFF with authorization code+PKCE, state, nonce, HttpOnly Secure cookie, CSRF, login/logout and session expiry; automated Playwright login test.
- One-time invitation with token hash, verified email/address and issuer+sub binding, email worker and provider integration, expiry/revoke/accept transaction, explicit owner transfer under tenant lock. Do not silently account-link by matching email.
- Product/tenant admin UI and role creation with product-scoped permission catalog, immutable assignment versioning and conflict handling. Idempotency keys for create endpoints.

## Increment 2: complete security and operations
- Add policy regression matrix per product and resource, service credential rotation, permission risk tier enforcement, rate limits and load tests.
- Outbox dispatcher with idempotent consumers, independently controlled immutable audit sink, reconciliation and admin event alerts. Restrict runtime DB grants; product DB composite tenant constraints/RLS where applicable.
- Production Keycloak HA, Postgres PITR with verified RTO/RPO, secrets manager, least-privilege service accounts, SLO telemetry, incident/rollback runbooks and DR drills.
- Privacy inventory, DSAR workflows spanning IdP and products, retention/deletion approvals, DPA/legal review, independent penetration test before enterprise claims.

## Increment 3: enterprise integrations
- Per-tenant federation, managed organization mapping, SCIM replay/tenant isolation, webhook SSRF/replay protection and second real product integration. Trace signed ADRs to acceptance evidence.
