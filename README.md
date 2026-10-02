# Shared IAM platform — runnable implementation baseline
A security-conscious **vertical slice**, not an enterprise-certified release. Stack: Node.js 22, TypeScript, Fastify, PostgreSQL, Keycloak 26.7.3. No custom credential/session store. Product data belongs to product DBs.

## Included
- `apps/iam`: bearer verification, tenant provisioning, role assignment/suspension, scoped decisions, audit and outbox transaction.
- `apps/demo-product`: protected resource API using `(tenant_id,resource_id)` lookup before authorization.
- `db/001_initial.sql`: IAM schema; `db/002_demo.sql`: separate demo product schema.
- `infra/compose.yaml`: development PostgreSQL instances and Keycloak; application services run on host.
- `tests/`: policy and token-boundary unit tests; live integration scenarios documented but not claimed executed.

## Local start (requires Docker, Node.js 22+, npm)
1. `cp .env.example .env`; `docker compose -f infra/compose.yaml up -d`; wait for Keycloak at localhost:8080 and Postgres readiness.
2. `npm install`; `npm run db:migrate`; `npm run typecheck`; `npm test`.
3. Configure Keycloak manually as specified in `docs/KEYCLOAK_DEV.md` (there is intentionally **no password-grant or authentication bypass**). Create `iam-api` and `demo-api` audiences; development login/client credentials via approved OAuth flows.
4. Register a product using `npm run seed:demo` (requires `DEMO_SERVICE_CLIENT_ID`, `DEMO_SERVICE_SUBJECT`, `DEMO_API_AUDIENCE`), provision first platform admin using `npm run seed:admin -- <issuer> <subject>` (the identity must already exist in Keycloak).
5. `npm run dev:iam` and `npm run dev:demo` in separate terminals. Test with real Keycloak tokens; `docs/SMOKE_TEST.md` lists curl/negative scenarios.

Do not deploy this repo to production unchanged. There is no login BFF, invitation email workflow, DSAR erasure/export execution, immutable audit sink, HA deployment, distributed rate limiting, full E2E suite, or external assessment. There is no package-lock because packages were not downloaded in this environment; generate and commit a lockfile before CI/release. The dev compose passwords are illustrative and MUST NOT be used in production. The SQL has not been executed against a live PostgreSQL engine here.

## API behavior
- IAM admin endpoints accept end-user JWT audience `iam-api`; platform admin is a DB allowlist `(issuer,sub)`, tenant admin is scoped to its tenant.
- `POST /v1/decisions/check` accepts an IAM-audience service JWT plus an end-user token minted for the registered product API audience. Actor identity derives ONLY from the validated user token. The application returns tenant/product/permission decision, not product resource ownership.
- Demo product validates its own API JWT, loads widget by tenant + ID and invokes IAM. Any IAM outage denies access. No token is logged.

## Production readiness gates
Pin exact dependency/image digests; implement BFF with code+PKCE, CSRF/session protection; full migration and Keycloak tests; external append-only audit sink; managed DB PITR with restore drill; security test and privacy/legal review. See `docs/PRODUCTION_GATES.md`.
