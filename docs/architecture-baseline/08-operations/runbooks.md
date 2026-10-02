# Deployment and operations runbooks
## Baseline deployment
Separate EU-region PostgreSQL instances/databases for IdP and IAM; encrypt managed DB backups; IaC pins Keycloak 26.7.3 image digest and DB versions after staging test. Start 2 Keycloak and 2 IAM app replicas across fault domains for paid availability target, ingress TLS and private Keycloak admin endpoint. IdP caches/session topology must follow tested vendor guidance. Product BFF stores encrypted sessions server-side; service credentials in secrets manager; DB app runtime role not schema owner. Staging mirrors configs using synthetic data.

## CI/CD and rollout
1. Validate schema diff and backward compatibility; record migration checksum. Deploy additive schema before app; forward-fix any destructive migration only after backup and rollout window.
2. Build/sign images; test OpenAPI, migrations, isolation, SAST/SCA, pinned IdP smoke. Deploy to staging with sample product X/Y.
3. Change approver reviews database backup, IdP upgrade notes and rollback. Canary IAM app, verify login/refresh/decision p95 and denial rates; maintain previous app for rollback while schema remains compatible.
4. Check Keycloak OIDC discovery and JWKS post-upgrade. Never retire signing keys before maximum issued token validity, including clock skew. Roll back config/app if smoke fails; restoring DB is not a routine rollback.

## Monitoring/SLO
Dashboard split: Keycloak login success/p95, token refresh errors, IAM decision p95/p99+5xx, DB connection saturation, IAM audit/outbox lag, product isolation denials, invitation failures. Availability: target 99.9% monthly for IAM decisions and separately IdP login once HA proven. Stage benchmark 100 RPS decision workload and realistic login/refresh mix; adjust capacity from measurements, not DAU guess. Alert sustained decision 5xx >1% for 5m, backup failure immediately, outbox lag >5m, unusual admin grants; tune after pilot.

## Failure actions
- IAM outage: product critical writes deny; routine reads deny in pilot. Restore service/DB; correlate errors; never enable allow-all fallback.
- IdP outage: new login/refresh blocked; existing sessions/tokens only until expiry; verify discovery/JWKS and broker health; communicate incident.
- Tenant leak: stop affected API route or apply deny policy; preserve logs; security+privacy owners assess scope and notification obligations before reopening after isolation suite.
- Token/key compromise: revoke sessions in IdP, suspend affected identities in IAM, rotate key only as appropriate, evaluate in-flight JWT validity and client JWKS caches; incident commander records impact.
- DB restore: isolate writes, PITR restore into fresh environment, compare migration checksums and outbox/audit reconciliation, execute T14, reroute only after consistency checks; reapply erasure decisions from restored backup.

## Recovery and ownership
RPO<=1h and RTO<=4h are acceptance targets, not verified figures. Test isolated PITR restore before G2 and quarterly thereafter; test IdP and IAM backups separately. Assign named incident commander, on-call backup, security reviewer and privacy counsel before production. Maintain emergency break-glass credentials offline with MFA, time limits and audit review. No claim of enterprise readiness without measured test and signed G2 gate.
