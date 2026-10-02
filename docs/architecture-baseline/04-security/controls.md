# Threat model and security baseline
| Threat | Requirement / verification |
|---|---|
| Cross-tenant IDOR | Product DB `(tenant_id,id)` lookup, IAM membership+product+permission; negative matrix against every read/write/list/export path |
| Token substitution | Validate issuer, audience, alg allowlist, kid/signature, exp/nbf and intended use; API rejects ID token; service client restricted to product |
| Stale access | Critical write hits primary membership DB every time; routine reads <=60s cache; test after committed revocation, during partitions, on key rotation |
| Account linking/invite hijack | One-use hashed invite, verified email match and confirmed IdP subject; no silent merge by equal email; tests across providers |
| Elevated admin | MFA, admin-specific audience/permissions, step-up for tenant transfer; break-glass time-limited and independently audited |
| Audit tampering | DB append-only privileges and external immutable evidence sink with reconciliation; DB sequence is not reliable commit order; do not claim hash-chain integrity without concurrency-safe design |
| SSRF/event abuse | Later webhooks: verified target ownership, private-IP block including DNS rebinding, HMAC timestamp/event ID, bounded retries/DLQ |
| Session attacks | PKCE/state/nonce, BFF cookie Secure/HttpOnly/SameSite, CSRF token, no bearer in browser localStorage, safe redirect validation |

Use current OAuth Security BCP RFC 9700 for code flow and refresh-token choices. Keycloak owns password and MFA policy. Admin MFA enforced from G1; WebAuthn preferred for sensitive admins when supported. Secrets manager, TLS, separate IdP/admin network, least-privilege DB roles, dependency scanning and supply-chain image pinning required.

Target control review: OWASP ASVS 5.0 Level 2, especially multi-tenant authorization, but claiming verified compliance requires evidence for each applicable control. Security review covers account recovery, SSO domain takeover, SCIM replay, session fixation, broken access control and DSAR identity proofing. No raw tokens in audit/traces.

GDPR: map controller/processor roles and lawful basis per operation; DPA/subprocessor and transfers review; document retention period by data class and backup restoration/deletion behavior; authenticate data subject, assess exemptions before erasure; legal review of breach notification obligations and DPIA applicability. EU hosting alone is not GDPR compliance. No default fixed 12-month retention rule.
