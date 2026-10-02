# Standalone Multi-Tenant IAM Platform

This repository contains a standalone, multi-tenant Identity and Access Management (IAM) platform. It provides tenant isolation, role-based access control (RBAC), invitations, and a centralized web BFF (Backend-For-Frontend) integrated with Keycloak OIDC.

## Repository Layout
- `apps/iam/`: The core IAM REST API (port 4000). Handles tenant, role, and permission management.
- `apps/web/`: The Next.js BFF and Admin UI (port 3000). Handles user sessions and interactive authentication.
- `apps/demo-product/`: A sample integrated SaaS product.
- `packages/security/`: Shared token validation and policy enforcement libraries.
- `db/`: The single source of truth for all database migrations.
- `scripts/`: Utilities for database migration, preflight checks, and seeding data.
- `tests/`: Automated unit and API integration tests.
- `infra/`: Docker Compose configuration for local dependencies (PostgreSQL, Keycloak, Mailpit).
- `docs/`: Source-of-truth documentation, integration guides, and runbooks.
  - `docs/architecture-baseline/`: Original design and reference material (v3 architecture).

## Source of Truth
- **Database Schema**: `db/*.sql` files are the executable source of truth. Illustrative schemas in the architecture package are deprecated reference material.
- **API Contract**: `docs/openapi-implemented.yaml` is aligned with the current routing implementation.

## Features Implemented
- Tenant creation with idempotency guarantees.
- Keycloak-based authentication with PKCE and MFA/ACR enforcement.
- Role-based Access Control (RBAC) and policy-based authorization decisions.
- Outbox pattern for event emission (implementation started but delivery workers remain in backlog).
- E-mail invitations with secure token verification.

## Limitations & Backlog
- **Second SaaS Product Integration**: The platform currently only seeds a single demo product. Multi-product reuse is NOT fully implemented or validated.
- **DSAR (Data Subject Access Requests)**: Not implemented.
- **Immutable Audit Evidence**: Audit events are written to the database, but independent immutable storage (e.g., WORM drives, signed logs) is not implemented.
- **SCIM Provisioning**: Not implemented.
- **Production TLS**: Local development relies on HTTP/HTTPS mixed setups; production deployments must terminate TLS properly and securely manage secrets.
- **Rate Limiting**: Missing from API routes.

## Startup Order & Exact Commands
1. **Start Infrastructure**: `docker compose -f infra/compose.yaml up -d`
2. **Setup Env**: Copy `.env.example` to `.env` and `apps/web/.env.example` to `apps/web/.env.local`, then replace placeholders.
3. **Migrate DB**: `npm run db:migrate`
4. **Configure Keycloak**: Use `setup_keycloak.py` or manually configure Keycloak as per `docs/KEYCLOAK_DEV.md`.
5. **Seed Demo & Admin**: `npx tsx scripts/seed-demo.ts` and `npx tsx scripts/seed-admin.ts <OIDC_ISSUER> <SUBJECT_ID>`
6. **Start Services**:
   - IAM API: `npm run dev:iam`
   - Web BFF: `cd apps/web && npm run dev`
   - Mail Worker: `npm run dev:mail`
