# Requirements and acceptance targets
## Actors and boundaries
People may belong to many tenants, tenants may access multiple products. Tenant is account/org boundary; product is app/API boundary. Identity is `(issuer,sub)`; role is permission composition within a tenant and product; persona is display/UX preference, never authorization. Product data is isolated in product DB. Platform admins have a separate workflow, not a magic cross-tenant bearer token.

| ID | Gate | Requirement | Acceptance |
|---|---|---|---|
| R01 | G1 | OIDC sign-in through IdP; code+PKCE; verified identity; recovery; MFA for platform admins | Login, account recovery, client redirect rejection and MFA negative E2E |
| R02 | G1 | Per-env product client and API audience; validate iss/aud/alg/exp/nbf/signature/type | Wrong issuer, wrong product audience, ID token as bearer all denied |
| R03 | G1 | Tenant lifecycle and `(issuer,sub)` membership mapping; two tenants per person supported | Invite/accept, switch, suspend; cannot authenticate as another identity using email |
| R04 | G1 | Tenant-product entitlements and tenant/product-scoped roles | Cross-tenant and cross-product requests denied even with valid login |
| R05 | G1 | Permission catalog product-owned; no role hierarchy; persona does not grant rights | Changing persona cannot change decision; last owner protected |
| R06 | G1 | Product backend enforces resource tenant after lookup in its DB; app IAM checks permission/membership | Forged tenant/resource/user payload denied; missing ownership denies |
| R07 | G1 | Authorization changes atomic with ordered audit and outbox events | Mutate + event in same DB transaction or both roll back |
| R08 | G2 | Suspension/role removal blocks critical writes on next DB-checked request after commit; routine checks cache <=60s | Timed concurrency test; critical outage fail-closed |
| R09 | G2 | Tenant and platform admin separation, MFA, invitation and last-owner guard | Privilege matrix E2E incl other-tenant and duplicate invite |
| R10 | G2 | Privacy inventory, DSAR export/erasure workflow, legal retention and vendor review | Signed case exercise across IdP and pilot product |
| R11 | G2 | HA, monitoring, backup, restore and incident procedures | RPO target 1h, RTO target 4h proved in isolated drill |
| R12 | G2 | Two products consume same authn/authz platform independently | Second product integration runbook exercise |
| R13 | G3 | Tenant federation OIDC/SAML, SCIM when contracted, independent security testing | Federation takeover/SCIM replay cases and pen-test closure |

SLO proposals subject to staged benchmark: IAM decision API p95 <100 ms in same region at measured 100 RPS, 99.9% monthly availability excluding announced maintenance only if contract permits; track IdP login separately. No product launch assumes tests or legal review happened solely because docs exist. Data loss/retention values are business proposals requiring approval.

Out of scope pilot: custom token endpoint, native/mobile SDK, ABAC engine, SCIM, product billing, multi-region active-active, platform-wide global superuser in product APIs.
