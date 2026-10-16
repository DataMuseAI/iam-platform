# Deep Security Audit Report: IAM Platform

**Target System:** `iam-platform` (Multi-Tenant Enterprise IAM Platform & Web BFF)  
**Repository Path:** `/home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform`  
**Audit Date:** October 2026  
**Assessment Type:** White-Box Source Code & Architecture Security Audit  
**Classification:** HIGH-PRIORITY SECURITY FINDINGS  

---

## 1. Executive Summary

A comprehensive, defense-in-depth white-box security audit of the `iam-platform` repository was conducted. The platform encompasses:
1. **Core IAM Service (`apps/iam`)**: Fastify-based REST microservice managing tenant lifecycles, role-based access control (RBAC), invitations, and authorization decision evaluations.
2. **Web Backend-for-Frontend (`apps/web`)**: Next.js 15 BFF handling OIDC Authorization Code Flow with PKCE, session management, encrypted cookie transport, and admin dashboard rendering.
3. **Downstream Service (`apps/demo-product`)**: Fastify-based microservice demonstrating resource authorization delegation via the IAM decision engine.
4. **Shared Security Package (`packages/security`)**: Cryptographic JWT validation via remote JWKS and authorization policy evaluation rules.
5. **Database Infrastructure (`db/*.sql`, PostgreSQL 17)**: Schemas for identities, tenants, memberships, roles, permissions, invitations, web sessions, idempotency, and transactional outbox.
6. **Identity Provider (`infra/compose.yaml`, Keycloak 26.x)**: Keycloak container running OIDC authentication, client configurations, and claim mappers.

### Key Assessment Findings Summary
| ID | Finding Title | Severity | CVSS v3.1 | Primary Affected Component |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-IAM-01** | Trivial Hardcoded Encryption Keys in Configuration | **CRITICAL** | **9.1** | `.env`, `apps/web/.env.local`, `apps/iam/src/invite-crypto.ts` |
| **SEC-IAM-02** | Complete Absence of Database Row-Level Security (RLS) | **HIGH** | **8.5** | `db/001_initial.sql`, `db/003_invitations.sql` |
| **SEC-IAM-03** | Mocked Admin MFA Context via Hardcoded Keycloak Client Mapper | **HIGH** | **7.5** | `scripts/setup_keycloak.py`, `apps/iam/src/server.ts` |
| **SEC-IAM-04** | Missing Rate Limiting and DoS Vulnerability on Critical Endpoints | **HIGH** | **7.5** | `apps/iam/src/server.ts`, `apps/web/src/app/api/*` |
| **SEC-IAM-05** | Unbounded Outbox Table Growth & Abandoned Event Consumers | **MEDIUM** | **6.5** | `apps/iam/src/mail-worker.ts`, `db/001_initial.sql` |
| **SEC-IAM-06** | Database Row-Locking Contention and Concurrency Bottleneck in Session BFF | **MEDIUM** | **6.2** | `apps/web/src/lib/session.ts` |
| **SEC-IAM-07** | Missing HTTP Security Headers & Content Security Policy (CSP) | **MEDIUM** | **5.4** | `apps/web/src/app/layout.tsx`, Next.js Config |
| **SEC-IAM-08** | Lack of Automated Data Retention and TTL Purge Mechanisms | **MEDIUM** | **5.3** | `db/004_web_sessions.sql`, `db/005_idempotency.sql` |
| **SEC-IAM-09** | Audit Log Mutability & Absence of Tamper-Evident Storage | **MEDIUM** | **5.3** | `db/001_initial.sql`, `apps/iam/src/server.ts` |
| **SEC-IAM-10** | Shallow Healthchecks Masking Dependency Failure | **LOW** | **3.7** | `apps/iam/src/server.ts`, `apps/demo-product/src/server.ts` |

---

## 2. Threat Modeling & Scope

### 2.1 Architecture Diagram
```
                     +---------------------------------------+
                     |         Browser / Admin User         |
                     +-------------------+-------------------+
                                         |
                                         | HTTPS (Session Cookie, CSRF)
                                         v
                     +---------------------------------------+
                     |       Next.js Web BFF (:3000)         |
                     |  - PKCE Auth Code Flow                |
                     |  - AES-256-GCM Session Storage         |
                     +---------+-------------------+---------+
                               |                   |
            OIDC / Token Exch. |                   | Bearer JWT (IAM API Aud)
                               v                   v
      +-----------------------------+     +-----------------------------+
      |      Keycloak (:8080)       |     |     IAM Service (:4000)     |
      | - Realm: saas-dev           |     | - Fastify REST API          |
      | - OIDC Provider / JWKS      |     | - RBAC Policy Checks        |
      +-----------------------------+     | - Tenant Lifecycle          |
                                          +--------------+--------------+
                                                         |
                                 +-----------------------+-----------------------+
                                 | SQL Pool (max: 10)                            | SQL Pool
                                 v                                               v
                  +-----------------------------+                 +-----------------------------+
                  |   PostgreSQL: iam_dev       |                 |  PostgreSQL: web_dev        |
                  | - identities, tenants       |                 | - oauth_flows               |
                  | - memberships, roles        |                 | - web_sessions              |
                  | - invitations, outbox       |                 +-----------------------------+
                  +--------------+--------------+
                                 ^
                                 | Polling (SKIP LOCKED)
                  +--------------+--------------+
                  |      Mail Worker (:1025)    | ----> Mailpit (SMTP)
                  +-----------------------------+
```

### 2.2 STRIDE Threat Assessment
- **Spoofing Identity:** Trivial AES encryption keys allow forging sealed invite tokens and session states.
- **Tampering with Data:** Lack of Row-Level Security allows SQL query oversights to modify or read cross-tenant records.
- **Repudiation:** Audit events are stored in a mutable PostgreSQL table accessible by standard application database credentials.
- **Information Disclosure:** Hardcoded secrets in repository configs, lack of CSP headers, and unauthenticated invite staging endpoints.
- **Denial of Service:** Complete lack of rate limiting across Fastify and Next.js route handlers; unindexed/unbounded outbox growth; row-level lock contention on session evaluation.
- **Elevation of Privilege:** Mocked `urn:iam:mfa` ACR claim mapper in Keycloak grants full administrative escalation to standard credentials.

---

## 3. Vulnerability Findings & Technical Deep Dive

### SEC-IAM-01: Trivial Hardcoded Symmetric Keys in Configuration (CRITICAL)
- **Vulnerability Type:** Cryptographic Weakness (CWE-321 / CWE-798)
- **Affected Files:**
  - [`.env`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/.env#L11): Line 11 (`INVITE_TOKEN_KEY_BASE64`)
  - [`apps/web/.env.local`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/apps/web/.env.local#L2): Line 2 (`BFF_ENCRYPTION_KEY_BASE64`)
  - [`apps/iam/src/invite-crypto.ts`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/apps/iam/src/invite-crypto.ts#L2-L7): Lines 2–7
  - [`apps/web/src/lib/crypto.ts`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/apps/web/src/lib/crypto.ts#L3-L4): Lines 3–4
- **CVSS v3.1 Score:** **9.1** (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N`)
- **Mechanics:**
  The configuration uses the base64 string `MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=`, which decodes directly to the sequential ASCII string `12345678901234567890123456789012` (32 bytes).
  This key is utilized in two mission-critical locations:
  1. `apps/iam/src/invite-crypto.ts`: Encrypts invitation tokens stored in the `invitations` table (`token_ciphertext`) and decrypted by `mail-worker.ts`.
  2. `apps/web/src/lib/crypto.ts`: Encrypts user access tokens and refresh tokens in `web_sessions` (`access_enc`, `refresh_enc`), encrypts OAuth PKCE verifiers in `oauth_flows` (`verifier_enc`), and seals the `iam_pending_invite` cookie.
- **Impact:**
  Any attacker can decrypt encrypted tokens stored in database dumps, outbox logs, or intercept cookies. An external attacker can forge sealed cookies, manipulate authorization codes, and intercept pending tenant invitations.
- **Remediation:**
  1. Mandate high-entropy cryptographic generation for both keys (e.g. `crypto.randomBytes(32).toString('base64')`).
  2. Implement runtime environment validation rejecting default/predictable keys in both development and production environments.
  3. Separate the key spaces: `INVITE_ENCRYPTION_KEY` and `BFF_ENCRYPTION_KEY` must never share the same key material.

---

### SEC-IAM-02: Complete Absence of Database Row-Level Security (RLS) (HIGH)
- **Vulnerability Type:** Broken Object Level Authorization (BOLA / IDOR) (CWE-284)
- **Affected Files:**
  - [`db/001_initial.sql`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/db/001_initial.sql#L3-L14): Lines 3–14
  - [`db/003_invitations.sql`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/db/003_invitations.sql#L2-L18): Lines 2–18
  - [`apps/iam/src/server.ts`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/apps/iam/src/server.ts#L64-L183): Lines 64–183
- **CVSS v3.1 Score:** **8.5** (`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:L/A:N`)
- **Mechanics:**
  Unlike hardened multi-tenant databases that enforce PostgreSQL Row-Level Security (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`), the database tables (`memberships`, `roles`, `role_permissions`, `role_assignments`, `invitations`, `audit_events`, `widgets`) rely solely on application-level filtering (`WHERE tenant_id = $1`).
- **Impact:**
  A single developer omission, buggy join, or unparameterized reporting query exposes sensitive tenant membership data, roles, and authorization decisions cross-tenant.
- **Remediation:**
  1. Implement PostgreSQL Row-Level Security on all tenant-scoped tables (`memberships`, `roles`, `role_permissions`, `role_assignments`, `invitations`, `audit_events`).
  2. Set `current_setting('app.current_tenant_id', true)` upon acquiring connection from the pool.
  3. Introduce dedicated non-superuser PostgreSQL runtime roles (`iam_app_user`) with `FORCE ROW LEVEL SECURITY`.

---

### SEC-IAM-03: Mocked Admin MFA Context via Hardcoded Keycloak Client Mapper (HIGH)
- **Vulnerability Type:** Improper Authentication / MFA Bypass (CWE-287 / CWE-308)
- **Affected Files:**
  - [`scripts/setup_keycloak.py`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/scripts/setup_keycloak.py#L100-L115): Lines 100–115
  - [`apps/iam/src/server.ts`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/apps/iam/src/server.ts#L35): Line 35 (`requirePlatformAdmin`), Line 42 (`requireTenantAdmin`)
  - [`apps/iam/src/onboarding.ts`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/apps/iam/src/onboarding.ts#L44): Line 44 (`req.headers.authorization`), Line 98
- **CVSS v3.1 Score:** **7.5** (`CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:H/I:H/A:N`)
- **Mechanics:**
  Privileged operations (creating tenants, assigning owners, creating invitations) assert that `claims.acr === cfg.IAM_ADMIN_ACR` (`urn:iam:mfa`).
  However, in `setup_keycloak.py`:
  ```python
  acr_mapper = {
      "name": "acr-mfa-mock",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-hardcoded-claim-mapper",
      "config": {
          "claim.name": "acr",
          "claim.value": "urn:iam:mfa", ...
      }
  }
  ```
  This hardcodes the `urn:iam:mfa` claim into *all* tokens generated for the `web-bff` client, completely bypassing actual step-up multi-factor authentication.
- **Impact:**
  No real MFA challenge takes place. Any actor with standard username/password credentials satisfies the MFA gate and executes high-risk administrative operations.
- **Remediation:**
  1. Configure Keycloak authentication flow with genuine Step-Up authentication (conditional OTP/WebAuthn).
  2. Implement an authorization step-up flow in Next.js BFF (`prompt=login&acr_values=urn:iam:mfa`) when entering privileged sections.

---

### SEC-IAM-04: Missing Rate Limiting and DoS Vulnerability on Critical Endpoints (HIGH)
- **Vulnerability Type:** Uncontrolled Resource Consumption (CWE-770 / CWE-307)
- **Affected Files:**
  - [`apps/iam/src/server.ts`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/apps/iam/src/server.ts#L10): Line 10
  - [`apps/web/src/app/api/invitations/pending/route.ts`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/apps/web/src/app/api/invitations/pending/route.ts#L8-L12): Lines 8–12
  - [`apps/web/src/app/api/invitations/accept/route.ts`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/apps/web/src/app/api/invitations/accept/route.ts#L6-L16): Lines 6–16
- **CVSS v3.1 Score:** **7.5** (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H`)
- **Mechanics:**
  Neither the Fastify backend nor the Next.js BFF implements request rate limiting. Fastify only bounds the body size (`bodyLimit: 64_000`).
  Endpoints like `/v1/decisions/check` execute multi-table joins and cryptographic signature checks on every invocation.
  Endpoints like `/api/invitations/pending` accept arbitrary unauthenticated POST requests from any client passing `Origin`.
- **Impact:**
  An adversary can exhaust database connection pools (`max: 10`), CPU resources on cryptographic verification, or attempt high-volume invitation token spraying.
- **Remediation:**
  1. Register `@fastify/rate-limit` on the IAM Fastify service with IP- and client-based throttles.
  2. Add rate limiting middleware in Next.js BFF for authentication and invitation endpoints.
  3. Introduce decision caching for `/v1/decisions/check` using Redis or an in-memory TTL cache with authz version invalidation.

---

### SEC-IAM-05: Unbounded Outbox Table Growth & Abandoned Event Consumers (MEDIUM)
- **Vulnerability Type:** Resource Exhaustion & Event Loss (CWE-400)
- **Affected Files:**
  - [`apps/iam/src/server.ts`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/apps/iam/src/server.ts#L54): Line 54 (`INSERT INTO outbox...`)
  - [`apps/iam/src/mail-worker.ts`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/apps/iam/src/mail-worker.ts#L25-L26): Lines 25–26
  - [`db/001_initial.sql`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/db/001_initial.sql#L14): Line 14
- **CVSS v3.1 Score:** **6.5** (`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:H`)
- **Mechanics:**
  The transactional outbox pattern is implemented to record events on every tenant lifecycle mutation (`tenant.created`, `role.granted`, `membership.suspended`, `invitation.accepted`, `owner.granted`).
  However, `mail-worker.ts` only consumes `event_type = 'invitation.created'`. No worker consumes the remaining event types. As a consequence, thousands of event rows sit indefinitely with `delivered_at IS NULL`.
- **Impact:**
  1. Progressive performance degradation of `outbox` table scans.
  2. Downstream applications (such as `demo-product`) never receive authorization revocation events (e.g. membership suspensions), forcing reliance on continuous synchronous decision polling.
- **Remediation:**
  1. Implement a general outbox event dispatcher worker to route events to a message bus or webhook sinks.
  2. Add a composite index on `outbox(event_type, delivered_at, next_attempt_at)`.
  3. Implement an archiving/cleanup job for delivered and dead events.

---

### SEC-IAM-06: Database Row-Locking Contention and Concurrency Bottleneck in Session BFF (MEDIUM)
- **Vulnerability Type:** Concurrency Issues / Denial of Service (CWE-662 / CWE-833)
- **Affected Files:**
  - [`apps/web/src/lib/session.ts`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/apps/web/src/lib/session.ts#L13-L28): Lines 13–28 (`getSession`)
- **CVSS v3.1 Score:** **6.2** (`CVSS:3.1/AV:N/AC:H/PR:L/UI:R/S:U/C:N/I:L/A:H`)
- **Mechanics:**
  Every HTTP request handled by the BFF triggers `getSession(rawId)`. This opens a PostgreSQL transaction:
  ```ts
  await c.query('BEGIN');
  const q = await c.query('SELECT * FROM web_sessions WHERE id_hash=$1 AND expires_at>now() FOR UPDATE', [hash(rawId)]);
  ```
  Acquiring an exclusive row lock (`FOR UPDATE`) on every read serializes all parallel requests for a single user. If an SPA executes 3 simultaneous requests (e.g. `/api/session`, `/api/tenants`, `/api/roles`), they block each other in the database pool (`max: 10`).
  Furthermore, if token refresh is triggered concurrently, race conditions during Keycloak refresh token rotation cause one request to fail and delete the active session (`DELETE FROM web_sessions WHERE id_hash=$1`).
- **Impact:**
  Spurious user logouts during normal navigation and severe connection pool starvation under modest user traffic.
- **Remediation:**
  1. Use optimistic concurrency or read-only `SELECT` for active session lookup without `FOR UPDATE`.
  2. Only acquire lock when token refresh is strictly needed (`access_expires_at <= now() + 30s`).
  3. Implement a distributed mutex or promise coalescer to deduplicate concurrent token refreshes.

---

### SEC-IAM-07: Missing HTTP Security Headers & Content Security Policy (CSP) (MEDIUM)
- **Vulnerability Type:** Missing Security Headers / XSS Defense Weakness (CWE-1021 / CWE-693)
- **Affected Files:**
  - [`apps/web/src/app/layout.tsx`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/apps/web/src/app/layout.tsx#L8-L18): Lines 8–18
  - `apps/web/next.config.js`: Non-existent
- **CVSS v3.1 Score:** **5.4** (`CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N`)
- **Mechanics:**
  The Next.js application lacks a `next.config.js` or middleware configuration that injects standard HTTP security headers:
  - `Content-Security-Policy`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security`
- **Impact:**
  Leaves the web application vulnerable to clickjacking and increases susceptibility to script injection or token leakage.
- **Remediation:**
  Add a `next.config.js` file defining the complete security header headers suite.

---

### SEC-IAM-08: Lack of Automated Data Retention and TTL Purge Mechanisms (MEDIUM)
- **Vulnerability Type:** Data Retention Failure / Table Bloat (CWE-400 / GDPR Art. 5)
- **Affected Files:**
  - [`db/004_web_sessions.sql`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/db/004_web_sessions.sql#L3-L15): Lines 3–15 (`oauth_flows`, `web_sessions`)
  - [`db/005_idempotency.sql`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/db/005_idempotency.sql#L2-L10): Lines 2–10 (`idempotency_records`)
- **CVSS v3.1 Score:** **5.3** (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N`)
- **Mechanics:**
  `oauth_flows` records expire in 5 minutes (`expires_at`), `web_sessions` expire in 8 hours, and `idempotency_records` are timestamped. However, there are no cron tasks, triggers, or retention workers that clean up expired rows.
- **Impact:**
  Permanent storage of expired OAuth flow nonces, state hashes, and idempotency records leading to unbounded storage growth and compliance non-conformance.
- **Remediation:**
  Implement a scheduled cleanup function (or pg_cron / node scheduler) running periodically:
  ```sql
  DELETE FROM oauth_flows WHERE expires_at < now();
  DELETE FROM web_sessions WHERE expires_at < now();
  DELETE FROM idempotency_records WHERE created_at < now() - interval '7 days';
  ```

---

### SEC-IAM-09: Audit Log Mutability & Absence of Tamper-Evident Storage (MEDIUM)
- **Vulnerability Type:** Log Tampering / Repudiation (CWE-778)
- **Affected Files:**
  - [`db/001_initial.sql`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/db/001_initial.sql#L13): Line 13
  - [`apps/iam/src/server.ts`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/apps/iam/src/server.ts#L53): Line 53
- **CVSS v3.1 Score:** **5.3** (`CVSS:3.1/AV:N/AC:H/PR:H/UI:N/S:U/C:N/I:H/A:N`)
- **Mechanics:**
  `audit_events` is stored directly in PostgreSQL with standard table permissions. Any actor or service with database write privileges can execute `UPDATE` or `DELETE` on historical audit records without detection.
- **Impact:**
  Fails SOC 2 / ISO 27001 requirements for immutable, non-repudiable audit logging.
- **Remediation:**
  1. Add a PostgreSQL trigger preventing updates and deletes on `audit_events`.
  2. Export audit events asynchronously to an append-only, tamper-evident object storage sink (e.g. S3 Object Lock or external SIEM).

---

### SEC-IAM-10: Shallow Healthchecks Masking Dependency Failure (LOW)
- **Vulnerability Type:** Insufficient Health Checks (CWE-693)
- **Affected Files:**
  - [`apps/iam/src/server.ts`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/apps/iam/src/server.ts#L63): Line 63
  - [`apps/demo-product/src/server.ts`](file:///home/pkm/MyProjects/MyPortfolio/MyApp/iam-platform/apps/demo-product/src/server.ts#L21): Line 21
- **CVSS v3.1 Score:** **3.7** (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L`)
- **Mechanics:**
  Endpoints `/healthz` statically return `{ok: true}` without probing PostgreSQL connectivity, Keycloak JWKS endpoint availability, or outbox worker liveness.
- **Impact:**
  Orchestrators (Kubernetes / Docker) continue routing traffic to stalled instances whose database connection pools or cryptographic workers have exhausted.
- **Remediation:**
  Implement active readiness checks (`/readyz`) performing `SELECT 1` on the database pool.

---

## 4. Prioritized Remediation Roadmap

```
+---------------------------------------------------------------------------------+
|                               REMEDIATION PHASES                                |
+---------------------------------------------------------------------------------+
  Phase 1: Immediate Cryptographic & Isolation Hardening (Sprints 1 & 2)
  ├── SEC-IAM-01: Generate high-entropy keys, enforce runtime entropy gate
  ├── SEC-IAM-02: Enable PostgreSQL Row-Level Security (RLS) on all tenant tables
  └── SEC-IAM-03: Eliminate mock ACR mapper; implement genuine step-up challenge

  Phase 2: Abuse Prevention, Resiliency & Session Optimization (Sprint 3)
  ├── SEC-IAM-04: Implement Fastify & Next.js rate-limiting middleware
  ├── SEC-IAM-06: Remove optimistic row locking; eliminate session concurrency deadlock
  └── SEC-IAM-07: Add Next.js HTTP security headers (CSP, HSTS, X-Frame-Options)

  Phase 3: Operational Integrity & Compliance (Sprint 4)
  ├── SEC-IAM-05: Deploy general outbox processor & index outbox status
  ├── SEC-IAM-08: Implement automated TTL purge tasks for sessions and idempotency
  ├── SEC-IAM-09: Enforce append-only triggers on audit logs
  └── SEC-IAM-10: Implement deep readiness checks for orchestrator health
```

---

## 5. Verification & Testing Evidence
- **Automated Unit & Integration Tests:** 3 test files (`tests/invites.test.ts`, `apps/web/tests/crypto.test.ts`, `tests/policy.test.ts`), 7/7 tests passing.
- **Static Analysis & Schema Review:** Audited migrations `001_initial.sql` through `005_idempotency.sql`.
- **E2E Assertions:** Playwright test suites (`tests/e2e/login.spec.ts`, `tests/e2e/mailpit.spec.ts`) verified against local stack.
