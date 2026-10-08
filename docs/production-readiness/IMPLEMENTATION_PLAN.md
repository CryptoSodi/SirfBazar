# Proposed Implementation Batches

Status: **proposal only; no batch approved or implemented by this audit**. Target R at 6c316b0 unless the owner selects a newer reviewed commit. Do not write fixes on older master then replace the running release.

## B1: Smallest First Batch

Close F01 only: unauthenticated merchant registration must not replace an existing identity's password, CNIC, name or contact.

| Field | Proposed boundary |
| --- | --- |
| Runtime scope after approval | apps/api/src/auth/auth.service.ts and focused synthetic tests; controller/DTO changes only if essential to retain a safe response contract. |
| Minimal approach | Reject the start request when its contact or CNIC belongs to any existing identity, before identity mutation/provider delivery. Existing customers use authenticated onboarding; staff/admin/owners use existing sign-in/recovery. Preserve first-time new-account OTP sequence. |
| Not included | Full signup pending-record redesign, Google, limiter, refresh, UI, OTP provider, schema, seed/data repair, packages, deployment or credential rotation. |
| Compatibility | Current fields and successful new signup remain; existing-identity start returns generic safe conflict/recovery guidance instead of changing another person's credentials. No new token/storage contract. Test existing signup retry behavior explicitly; do not silently overwrite a pending account to improve usability. |
| Tests | Mocked AuthService/Prisma/provider fixtures only, reviewed for env/DB/network isolation before invocation; test table below. |
| Dependencies | Confirm selected branch and repository protected-file instructions; fixtures do not need database schema changes. |
| Rollback | No data migration. A code revert reopens F01: use forward correction, or an explicitly approved narrow registration-start gate while keeping verified login/recovery/onboarding. Never treat returning to unsafe source as an acceptable unattended recovery. |
| Release gate | Focused tests + typecheck in an approved isolated copy; successful new signup and rejected takeover cases; review exact diff; deploy only under separate authorization with preserved live config/WhatsApp. |

Required B1 tests:
1. Existing active staff with null CNIC: attempted start changes no user fields, role, staff permissions or sessions; proposed password remains unusable.
2. Existing customer, admin and merchant owner: same-contact start cannot overwrite credentials; no fresh provider request on rejected registration.
3. CNIC belongs to another identity or contact/CNIC conflict: do not repoint either account's contact.
4. Repeated existing-identity requests and racing duplicate starts cannot bypass the guard; DB uniqueness error gives a safe response without partial identity update.
5. Genuine new registration still produces the existing challenge contract and verifies only the correct unconsumed purpose/code.
6. Wrong/replayed/expired OTP cannot verify; provider failure/uncertain response preserves the existing safe OTP handling.
7. Authenticated existing customer onboarding and explicit password recovery remain separate valid flows; rejected public start never grants merchant/admin roles.

These tests establish the narrow fix; they do not certify all OTP abuse, identity reservation or all T01-T32 cases. All execution is deferred until approval.

## Ordered Follow-On Batches

| Batch | Priority / findings | Scope and prerequisites | Tests / compatibility / rollback |
| --- | --- | --- | --- |
| B2 Google and production startup | Urgent F02/F14 | Fail closed on production mock/unknown provider; verified audience(s)/issuer/email claims and timeout; validate required signing config without printing secrets. Owner decides disabled Google vs configured provider and real client audience set. Leave WhatsApp unchanged. | Mock provider/config unit tests, wrong claims; OTP/password paths remain. Disabling only Google is safer than reverting to mock. No live login or env change without approval. |
| B3 Permission/boundary/upload/egress | P1 F03/F09/F10/F14 | Exact document reader policy, profile projection, private no-store, bounded DTO/input rules, real file signatures/dimensions/extensions/quotas and browser-push egress. Preserve assets and existing storage. | T02/T03/T20/T28/T32 synthetic fixtures; approved decoder dependency if needed. Restricted staff lose unauthorized access only; rollback must not make documents public. Edge/header edits separately authorized. |
| B4 Distinct rate budgets | P1 F04 | Map approved proxy hop(s)/trusted headers, IP + actor + resource policies, shared atomic storage, bounded keys, Retry-After and outage policy. Reuse OTP recipient fence. No guessed pilot limits. | T05-T08/T25 two isolated API instances; fake limiter outage and NAT/proxy tests. Clients keep sessions/purchase references on 429. Storage/schema or infrastructure changes need separate approval and policy-specific rollback. |
| B5 Server/session recovery | P1 F05/F06 | Atomic refresh consume/successor; explicit lost-response/reuse/sid policy, all web refresh fences and private cache epoch. Coordinate native/client renew behavior before changing server semantics. | T24, concurrent refresh/late write/account switch/multi-tab; no private state resurrects after logout. Version-compatible session transition; rollback may require re-login, never weak JWT or plaintext fallback. |
| B6 Durable effects | P1 F08 | Stable event IDs and transaction outbox with bounded worker leases/retries/dead letters; stop old worker/drain. Requires separately approved schema evolution; do not modify protected schema/app-module by implication. | T19 crash before/after send/ack, duplicate event and provider uncertainty; providers outside DB transactions. Preserve pending events through code rollback; don't rerun money actions to retry push. |
| B7 Mobile secure storage/lifecycle | P1 F06/F07 | Merchant/rider SecureStore migration and serialized single-flight writes/deadlines; test typed rider timeout/status-0 uncertainty before adding a timeout helper, and foreground timer lifecycle. Reuse customer behavior; preserve all approved native layouts/themes/rider actions. | T24/T26/T27/T29/T31, mocked storage and permission APIs then approved native fixtures. New deps/build approval required; old APK downgrade may require sign-in. No exporting secure credentials back to plaintext. |
| B8 Business invariant gaps | P1 F11 / REL / MONEY | Actor/cart locking or reviewed active-owner uniqueness, guest edit/merge races; rider assignment/completion retry/kill tests; admin nonterminal override policy; signed fee/discount/COD physical collection/reconciliation agreement. Never restore customer payment simulation. | T09-T18 and POS no-ID policy. Migrations/legacy COD repair are separate approvals. Prefer code-only locks using existing DB when sufficient; no silent cart deletion/financial rewrite rollback. |
| B9 Operations evidence and completion | P1 F12; start evidence work early, not after optimization | Correlation/redaction/metrics and named alerts; distinguish process liveness/DB readiness/optional provider status; bounded drain. Secure backup inventory/RPO/RTO, isolated full restore and code rollback rehearsal. Preserve disabled auto-deploy decision. | T30/T32; restore database + storage/private docs/config to isolated target, validate invariants and runtime recovery. No live DB restore, DNS/proxy changes, other-service restart or new account/secrets without new authorization. |
| B10 Measured query/cache improvements | P2 F13 | Synthetic data/query traces/plans/p50/p95/p99; optimize best-offer/pagination and N+1 only from evidence. Public cache keys/invalidation/cardinality; negative cache only if needed. | T20-T23, no personal cache bleed; stale/outage/cold stampede behavior. Index migration needs approval; preserve exact totals, financial authority and guest public behavior. Bloom stays deferred absent proof. |
| B11 Release acceptance | P1 open gates | Owner review all open findings, exact artifact/API clients, native builds, staged full role journey, monitoring/restore/rollback evidence. Capacity/security tests only on separately authorized nonproduction scope. | Complete T01-T32 applicable cases and exceptions; staged activation/observations and rollback; production rollout remains a distinct human approval. |

Parallel urgency means F02 configuration exposure and backup/alert evidence should be escalated now; it does not authorize implementing B2/B9 under approval of B1.

## Approval Boundaries

Approve code/tests by batch, then approve any dependencies, schema/storage/provider/configuration changes separately. A passed build or previous deployment approval is not blanket hardening authorization.

Do not enable SIRFBAZAR_API_DEPLOY_ENABLED or create the previously declined deployment account/GitHub secrets. Do not run any test script whose env/imports can reach a shared database/provider. Do not execute seeds, catalogue rollouts, old mutation scripts or staging suites as part of this audit.

Next decision: **approve B1's narrow source fix and isolated synthetic tests**, or request changes to its scope. All later batches and production actions remain held.
