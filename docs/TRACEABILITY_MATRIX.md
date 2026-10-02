# Traceability Matrix

| Requirement | Code Route/Module | Database Table/Migration | Test Coverage | Documentation Status |
|-------------|-------------------|--------------------------|---------------|----------------------|
| Create Tenant (Idempotency) | `POST /v1/tenants` (`server.ts`) | `005_idempotency.sql`, `idempotency_records` table | Unit tests passed. E2E NOT RUN. | Updated in `openapi-implemented.yaml`. |
| IAM Decision Check | `POST /v1/decisions/check` (`server.ts`) | Relies on `001_initial.sql` logic and JWT parsing | Checked via `check_routes.py`. E2E NOT RUN. | Described in `openapi-implemented.yaml`. Note: `critical` flag omitted from input as requested. |
| Fetch Memberships | `GET /v1/me/memberships` (`server.ts`) | `memberships`, `tenants`, `tenant_products` | Checked via `check_routes.py`. E2E NOT RUN. | Matches schema in OpenAPI. |
| Invitations (Create) | `POST /v1/tenants/{id}/invitations` (`onboarding.ts`) | `003_invitations.sql`, `invitations` table | `invites.test.ts` passed. | Described in `openapi-implemented.yaml`. |
| Invitations (Accept) | `POST /v1/invitations/accept` (`onboarding.ts`) | `003_invitations.sql`, `invitations` table | `invites.test.ts` passed. | Described in `openapi-implemented.yaml`. |
| Suspend Member | `POST /v1/tenants/{id}/memberships/{id}/suspend` (`server.ts`) | `memberships` status update | Unit tested. E2E NOT RUN. | Described in `openapi-implemented.yaml`. |
| MFA Enforcement | `requirePlatformAdmin` & `requireTenantAdmin` (`server.ts`) | JWT ACR Claim checking against `IAM_ADMIN_ACR` | JWT Logic tested. End-to-end NOT RUN. | Covered by Security Review. |
| Mail Delivery | `mail-worker.ts` | Listens to `outbox` | NOT RUN automatically. | Documented. |
