# Gap register after correction pack
| Finding | Status | Acceptance evidence required |
|---|---|---|
| A01, A02 | Patched in source; unverified | Compare new OpenAPI with merged routes; run API schema contract tests, including idempotency and unknown tenant decision. |
| A03 | Documented only | Fresh + upgrade migrations executed against PostgreSQL; ensure no v3 reference SQL applied. |
| A04, A12 | Open | Actual four ZIPs merged; npm install/typecheck/tests/Next build and E2E logs. |
| A05, A06 | Partially patched | Version and test Keycloak clients, audiences, email_verified and MFA ACR step-up; fail both non-MFA and wrong-audience tokens. |
| A07 | Open | Lifecycle event dispatcher, at-least-once consumers, independently controlled audit sink and reconciler. |
| A08 | Open | GDPR data inventory/case workflow spanning IdP, IAM, products and backups with legal signoff. |
| A09, A10 | Open | Second SaaS application/SDK and negative tenant/product/resource tests automated. |
| A11 | Open | Persona UX model/schema/API or explicit scope deferral in all docs. |
| A13 | Open | Production IaC, TLS, private admin network, secrets, backup and restore drills. |
| A14 | Open | Web session/flow cleanup, logout/revocation retry and security tests. |
| A15 | Open | Queue lease/monitoring/DLQ and duplicate-mail tests; never present mail worker as HA-ready. |
| A16 | Open | Use discovery for core JWKS or freeze Keycloak dependency in signed ADR with upgrade tests. |
| A17 | Open | Distributed rate limits, quotas, security events and abuse tests. |
| A18 | Partially addressed | Preflight checks root/web env keys and migration list; actual runtime validation pending. |

Go/no-go: no production or external-tenant go-live until A04-A10/A12-A15/A17 have test and review evidence. This pack is a change proposal, not a passed test report.
