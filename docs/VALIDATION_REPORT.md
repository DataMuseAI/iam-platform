# Validation Report

## Build and Static Checks
- **Node/NPM Check**: Executed `node -v` (v22.22.3) and `npm -v` (10.9.8).
- **Dependency Installation**: `npm install` in root and `apps/web`. Completed successfully (exit code 0); lockfiles generated and committed.
- **Root Typecheck & Test**: `npm run typecheck` and `npm run test` passed (exit code 0).
- **Web Typecheck, Test, Build**: Build initially failed due to missing/invalid environment variables. Fixed by copying `.env.example` to `.env.local`, satisfying the 40-char BFF key requirement, setting `WEB_BASE_URL` to https, and injecting variables via `set -a && source .env && set +a`. Passed successfully.
- **Python Route Check**: `python3 scripts/check_routes.py` passed (9 routes matched).
- **Python Preflight**: `python3 scripts/preflight.py` passed once environment variables were injected into the shell.

## Local Integration Tests
- **Docker Compose**: Started `infra/compose.yaml`. Fixed port conflicts for `iam-db` (mapped to 5436) and `demo-db` (mapped to 5437). All containers healthy.
- **Database Migrations**: Ran `npm run db:migrate`. Passed successfully against all target schemas (exit code 0).
- **Seed Scripts**: Ran `npx tsx scripts/seed-demo.ts` and successfully generated `DEMO_PRODUCT_ID`. Configured Keycloak via `setup_keycloak.py` and ran `seed-admin.ts` to assign platform operator permissions. Passed.
- **E2E Browser/Session Flow**: **NOT RUN**. A dedicated automated browser suite (e.g., Playwright/Cypress) is missing. Keycloak configuration and Next.js startup were confirmed functional.
- **Tenant Isolation**: **NOT RUN**. Requires cross-tenant session automated browser flow which is blocked by missing E2E setup.
- **IAM Outage Fail-Closed**: **NOT RUN**.

## Security Review Fixes
- Addressed Keycloak dev credentials and PKCE flow via custom python bootstrapping (`setup_keycloak.py`).
- Next.js build correctly enforces HTTPS for production BFF via environment variables constraint (`WEB_BASE_URL`).
- Ensure `INVITE_TOKEN_KEY_BASE64` enforces exactly 32 decoded bytes.

## Blockers
- Missing E2E browser testing suite (e.g., Playwright) for automated multi-tenant flow validation.
