# Verification plan (must produce evidence)
Test infrastructure: isolated disposable IdP and Postgres databases in CI; schema migration applied from zero and on previous version; seeded tenants A/B and products X/Y; product API fake resources with `(tenant_id,id)` keys. Smoke tests in stage with actual pinned IdP settings. All security regression tests block merge.

| Test ID | Scenario | Expected |
|---|---|---|
| T01 | Code+PKCE login; redirect URI mismatch; state replay | Success only for registered redirect, fresh state/nonce |
| T02 | Wrong iss/aud/alg/expired/ID token to API | 401; no product DB access |
| T03 | Membership A, attempt B and product Y using valid product X token | Denied; no tenant existence disclosed |
| T04 | Forged resource ID belonging to B, supplied tenant A | Product `(tenant_id,id)` query returns none; deny |
| T05 | Service client product X asks IAM decision for Y or fabricated user token | Deny |
| T06 | Remove role/suspend under concurrent writes and requests | Critical write after commit denied; routine <=60s stale window observed |
| T07 | Two simultaneous owner removal operations | At least one denied; >=1 active owner survives |
| T08 | Same invite accepted twice; expired/revoked; mismatched email/sub | Single grant only; others denied |
| T09 | Insert role assignment across tenant/product; duplicate permission | DB rejects with FK/unique violation |
| T10 | Mutation rolled back after audit/outbox insert | Neither grant nor event committed |
| T11 | Outbox delivery twice, consumer receives out-of-order versions | Idempotent processing, monotonically versioned aggregate state |
| T12 | JWKS rotation, IdP outage, IAM/DB outage | Key rollover validated, new login failure communicated, writes fail closed |
| T13 | DSAR export across IdP/product; erasure exception; restored backup | Reviewed complete evidence and re-delete playbook |
| T14 | PITR restore into isolation after injected DB failure | Recorded RPO<=1h, RTO<=4h or release gate fails |
| T15 | Load mix at 100 RPS decision, login and refresh independently | IAM p95<100ms decision target; recorded error rate and sizing |

CI checks: format/lint/typecheck, SAST/SCA/secrets, OpenAPI parser+contract tests, SQL migration apply/revert or forward-fix tests, negative authorization tests, dependency image scan. Staging: enterprise IdP integration, at least two real product API integrations before G2. Independent pen test before G3.

Definition of done for every story: code and test merged; no high/critical unmitigated issue; telemetry/alerts updated; rollback or forward fix tested; docs/ADR/traceability changed; reviewer records evidence link. This document is a test plan, **not test results**.
