# Remaining Gates to Production

The platform currently operates successfully under local constraints, but remains gated by the following required actions:

## Prioritized Local Pilot Gates
1. **Automated E2E Suite**: ✅ Playwright has been introduced (`npm run test:e2e`). Foundational UI flow tests for Keycloak and the Dashboard are implemented in `tests/e2e/login.spec.ts`. Cross-tenant and negative assertions will be added iteratively.
2. **Mailpit Assertions**: ✅ Scaffolded in `tests/e2e/mailpit.spec.ts`. It queries the local Mailpit API to verify message payloads (pending full API integration to trigger emails).

## External-Tenant & Pre-Production Gates
1. **Multi-Product Reusability Proof**: Stand up a secondary demo application alongside `demo-product` and confirm that JWT token audience routing and Keycloak configurations securely separate the apps.
2. **Database Resilience & Upgrades**: Ensure the DB schemas include downgrade paths, and verify migrations don't lock critical tables.

## Production Gates
1. **Security & Pentesting**: Must secure external penetration testing validation. JWT verification logic and CSRF mechanisms need formal infosec sign-off.
2. **Legal & Privacy Sign-off**: Data Subject Access Requests (DSAR) and explicit consent forms are not yet finalized.
3. **Infrastructure Harden**: Replace local `.env` and hardcoded tokens with Vault or similar secrets management. Ensure robust TLS and WAF implementations.
4. **Independent Immutable Audit Logs**: Direct database inserts for audit logs (`audit_events`) are insufficient for production compliance; require a secure log forwarding agent (e.g. FluentBit to immutable S3).
