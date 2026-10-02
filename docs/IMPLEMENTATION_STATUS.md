# Implementation Status

| Feature / Component | Status | Notes |
|---------------------|--------|-------|
| Repository Assembly | IMPLEMENTED | All correction packs and increments are unified into a single repository layout. |
| IAM API (Core)      | IMPLEMENTED | API routes match the correction pack `openapi-implemented.yaml`. |
| Web BFF & Admin UI  | IMPLEMENTED | Next.js app integrated with Keycloak OIDC, handles sessions securely. |
| Keycloak Integration| IMPLEMENTED | Tested PKCE flows, service accounts, and API audience scoping locally via `setup_keycloak.py`. |
| Database Migrations | IMPLEMENTED | Segregated schema definitions running successfully against local PostgreSQL containers. |
| Tenant Idempotency  | IMPLEMENTED | `Idempotency-Key` correctly processed for `/v1/tenants` endpoint. |
| MFA Enforcement     | IMPLEMENTED | `IAM_ADMIN_ACR` check implemented and strictly requires correct authentication context. |
| Invitations         | IMPLEMENTED | Mail worker dispatching emails; endpoints accept/reject tokens securely based on verified email claims. |
| Second SaaS Product | NOT IMPLEMENTED | Platform currently seeds a single demo product. Multi-product reuse logic is missing or unverified. |
| DSAR / GDPR         | NOT IMPLEMENTED | Privacy inventory exists as a baseline document, but automated data subject access requests are not present. |
| Immutable Audit     | PARTIALLY IMPLEMENTED | Events are written to the database via outbox pattern, but independent immutable storage is not implemented. |
| SCIM Provisioning   | NOT IMPLEMENTED | SCIM interfaces are absent. |
