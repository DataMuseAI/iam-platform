# Implementation backlog (canonical story IDs)
Each story includes user value, measurable AC and gate; split into tasks during sprint planning. Estimates deliberately omitted until team sizing. Dependencies are explicit.

## E01 IdP and platform foundation
- S01 [G0/R01/R02] As product developer, I can log in using centrally configured IdP. AC: Keycloak 26.7.3 staging spike proves code+PKCE, discovery, email verify, recovery, MFA, correct BFF session handling; negative redirect and audience cases T01/T02 pass.
- S02 [G1/R02] As API developer, I use a token verifier to reject substituted credentials. AC: allowlist iss/aud/alg and reject all T02 cases in product X and Y; key rollover T12.
- S03 [G1/R03] As operator, I provision tenant, owner and initial product atomically. AC: repeated idempotency key returns same tenant; conflict if body differs; no tenant with zero owners.

## E02 Tenant/product access
- S04 [G1/R03/R04] As tenant admin, I invite a verified colleague. AC: single-use hashed invite, revoked/expired/mismatched account denied T08; other-tenant admin denied.
- S05 [G1/R04/R05] As tenant admin, I assign product-scoped role. AC: custom role only references same product permissions; cross-tenant FK negative T09; no persona-based permission.
- S06 [G1/R06] As product API, I protect resources and ask IAM for permission. AC: product DB tenant/resource lookup precedes mutation; IAM authenticates service and validates user token audience; T03-T05 pass.

## E03 Governance and lifecycle
- S07 [G1/R07] As security auditor, I can observe every grant mutation. AC: same transaction stores audit event and outbox row; T10/T11 pass; offsite sink reconciliation.
- S08 [G2/R08] As tenant admin, I revoke membership/role so access ends within defined bounds. AC: T06 measured with critical no-cache check, routine <=60s; DB outage fails closed.
- S09 [G2/R09] As platform admin, I manage tenants through privileged APIs. AC: MFA, admin audience and last-owner constraint, T07; no cross-tenant bearer shortcut.
- S10 [G2/R10] As verified data subject, I can request access/export/erase review. AC: case status and evidence cover IdP, IAM and product; counsel signs exceptions T13.

## E04 Platform consumption and operations
- S11 [G2/R12] As second product team, I integrate from SDK/runbook. AC: another engineer deploys product Y without IAM code change; T03/T05 run in both products.
- S12 [G2/R11] As operator, I detect and recover faults. AC: separate login/decision SLIs, alert drills, T12/T14/T15 results archived.
- S13 [G2/R05] As user, I choose a persona without changing rights. AC: assigned persona changes UI only and T03/T06 rights unchanged.

## E05 Enterprise extensions (deferred)
- S14 [G3/R13] As enterprise admin, I configure per-tenant federation. AC: IdP org mapping and takeover tests; recovery plan for misconfigured IdP.
- S15 [G3/R13] As enterprise admin, I manage lifecycle by SCIM. AC: duplicate/out-of-order provisioning and tenant mapping tests pass.
- S16 [G3/R13] As security owner, I release after independent assessment. AC: high/critical findings remediated or formally risk-accepted with expiry and retest.

Critical path: S01->S02/S03->S04/S05->S06->S07->G1 pilot; S08-S12->G2; S14-S16->G3. Do not start S14/S15 as a substitute for completing tenancy isolation.
