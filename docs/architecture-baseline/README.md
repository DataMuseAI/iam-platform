# Shared IAM platform — implementation baseline v3
Version 3.0; date 2026-09-28; owner DataMuseAI; status: **ready for implementation planning**, not deployed, security-assessed or legally certified.

Read: `00-governance/decisions.md` -> `01-product/requirements.md` -> `02-architecture/solution.md` -> `03-contracts/openapi.yaml` -> `04-security/controls.md` -> `05-data/001_initial.sql` -> `06-quality/verification.md` -> `07-delivery/backlog.md` -> `08-operations/runbooks.md`. `traceability.csv` connects requirements, stories, tests and gates.

Scope: centralized Keycloak authentication; application-owned tenant/product memberships and RBAC; no homemade OAuth server; personas affect UX only. Pilot web product and one API; no SCIM/SAML/ABAC in pilot. See ADRs for explicit boundaries. Architecture provides build directions, not assurance that a vendor setting, legal obligation or runtime behavior has been proven. All artifacts are examples to be exercised against pinned deployments.

Release gates: G0 ADRs signed and Keycloak spike passed; G1 CI tests + pilot; G2 external tenant security/privacy/on-call sign-off; G3 enterprise federation + independent security assessment. Unapproved gates block corresponding release, not necessarily local development.

Earlier project artifacts are superseded: original requirements; 01-07 docs, CSV; reviewed-v2 archive. Their inconsistencies are recorded in `00-governance/reconciliation.md`.
