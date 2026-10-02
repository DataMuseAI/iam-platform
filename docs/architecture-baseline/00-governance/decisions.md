# Decisions and approvals
| ADR | Status | Decision | Owner and verification |
|---|---|---|---|
| 001 | Proposed G0 | Keycloak 26.7.3 as IdP baseline; pin exact tested image digest in deployment config; one realm per environment, separate OAuth clients per product/API. Shared realm not contractual isolation. | Architect: confirm Organizations, token mapping, federation, admin actions in staging. |
| 002 | Accepted design | Keycloak owns password/MFA/OIDC sessions/refresh tokens/signing keys. Application DB holds `(issuer,sub)` identity reference, tenant/product grants, roles, personas. Email never identity key. | Backend lead verifies no duplicate credentials in app DB. |
| 003 | Accepted design | IAM application is TypeScript modular service + PostgreSQL 17; Next.js web BFF. SDK first for TypeScript API. Python SDK after pilot. Product resource data remain product-owned. | Tech lead validates integration. |
| 004 | Proposed G0 | BFF Authorization Code+PKCE, server-side tokens, Secure HttpOnly SameSite=Lax session cookie and CSRF protection. Backend validates API access JWT. Avoid storing bearer tokens in browser JS. | Security reviewer tests login/logout/CSRF. |
| 005 | Proposed G0 | Each request checks scoped membership/product/permission; cache routine reads <=60s; critical writes check current DB (no authz cache). Product backend retrieves resource tenant from its own DB and checks against selected tenant. | Security reviewer signs stale-window test; product integration contract. |
| 006 | Accepted design | Product permission names unique `product:resource:action`; personas never grant access. Custom role scoped `(tenant,product)`. No hierarchy initially. | Domain owner signs catalog. |
| 007 | Proposed G2 | EU-region production, vendor DPA/transfer assessment, retention matrix, controller/processor allocation per product. | Privacy/legal owner signs before real external users. |
| 008 | Proposed G2 | Self-hosted Keycloak with separate managed PostgreSQL and two app replicas in EU region; staging can be smaller. Managed Keycloak alternative if ops owner unavailable; no fixed DAU crossover. | Ops owner demonstrates restore, alerting, patching. |

G0 recorded sign-offs required from owner, implementer and security reviewer. If a proposed ADR changes, edit contracts and traceability before implementation. Keycloak Organizations are an IdP convenience for sign-in and federation, **not** app authorization source; reconcile by `(issuer,sub)` and stable organization ID, never email/domain alone.
