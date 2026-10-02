# Data flows and state transitions
Identities: IdP subject is never inferred from mutable email. Registering from invite requires verified IdP email matching invited address and explicit account-link verification; never auto-link preexisting identities on equal email alone. Invitations are hashed, one-use, 7-day expiry, accepted only once under row lock. Handle change of email without changing subject.

Tenant provision: create tenant, product entitlement, baseline roles, and owner membership atomically; idempotency key held separately by API middleware. Last active owner removal rejected under tenant lock. Tenant suspend prevents IAM decisions regardless of valid access JWT. Product suspend also denies decisions. Role update increments per-tenant/product `authz_version` and writes outbox+audit transactionally.

Persona: if multiple assigned personas, user selects UX key; no persona claim needed for authorization. Client can display persona context but backend ignores it for access.

Offboarding: app membership/role state is revoked in DB; critical checks see commit immediately on primary; routine checks may remain stale <=60s. Invoke IdP logout/revoke through admin plane as defense in depth; measure propagation and handle retry failure. Do not claim revocation of already issued offline JWTs. Product resource deletion/retention is handled by product owners, not IAM alone.

Schema ownership: identity mapping and grants in IAM DB, user personal details in IdP, resource owner/tenant in product DB. Organization federation metadata in IdP; application maps stable org ID to tenant and reconciles. Never use domain alone as authorization proof.
