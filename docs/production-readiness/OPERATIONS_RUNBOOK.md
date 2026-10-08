# Operations Readiness Runbook

Phase 0 evidence and **proposed procedures only**, 2026-10-08. No server/account/database/Cloudflare/Caddy/provider change was executed. Follow these procedures only under a separate approved operational scope.

## Known State Versus Unknown State

Historical deployment records/source describe API on 129.153.16.84, dedicated sirfbazar-api.service, existing PostgreSQL sirfbazar, direct api.sirfbazar.com DNS/Caddy to 127.0.0.1:3002, config /etc/sirfbazar-api.env, runtime /var/lib/sirfbazar-api and code /opt/sirfbazar-api/current. Source R API matches historical deployed 1ab4208. **None of these runtime/configuration assertions was refreshed by SSH or API during this audit.**

Source guide [docs/API-AUTO-DEPLOYMENT.md](<C:/Users/tassa/.codex/worktrees/api-icons-release/SirfBazar/docs/API-AUTO-DEPLOYMENT.md:3>) explicitly says auto-deployment is prepared, not activated. The owner declined creating the restricted SSH account and GitHub credentials. Treat that decision as binding; an audit is not activation approval.

| Control | Status | Evidence / missing acceptance |
| --- | --- | --- |
| Dedicated API service/user/runtime directory | PARTIAL historical operational evidence | Existing deployment records; current unit hardening/permissions/resource caps/process not reverified. |
| Database/service isolation | PARTIAL historical evidence | Dedicated SirfBazar database/role on existing PostgreSQL; never change other services/APIs or PostgreSQL instance settings by implication. |
| Release/env/uploads separation | PARTIAL source / historical deployment | Immutable code vs persistent storage/private files; current filesystem/offsite inventory unverified. |
| Public/local health helper | PARTIAL prepared source | deploy/api/healthcheck.cjs uses read-only checks, cannot establish all app/business invariants. Not installed/enabled as automatic deployment evidence. |
| Process liveness / DB readiness | MISSING explicit API endpoints in traced bootstrap/controller inventory | Catalogue readiness exists historically; dependency-specific health and bounded DB check needed. Do not equate Swagger/network 200 with database/business health. |
| Optional WhatsApp/Google/push status | PARTIAL | Sanitized WhatsApp readiness source present; provider failure should alert/gate affected feature, not repeatedly restart otherwise healthy API. |
| Logs | PARTIAL | Nest/service warnings/audit records; correlation/redaction across HTTP/WS/worker/providers not established. |
| Metrics/alert routing | UNVERIFIED deployment; MISSING app instrumentation in traced bootstrap | No request-ID interceptor, HTTP duration/status/limiter/business/outbox metrics endpoint traced. Named owner, on-call and notification path not supplied. |
| Graceful drain | PARTIAL timer destroy hook; MISSING enabled Nest shutdown hooks in bootstrap | No proven request/worker/WS drain before restart. Helper service restart/rollback does not supply application drain semantics. |
| Scheduled backups / offsite / encryption / retention | UNVERIFIED | Historical cutover backups and future dump/list code are not a current recurring backup policy. |
| Full restoration | UNVERIFIED | No complete database/config/uploads/private-documents restore and application validation evidence reviewed. |
| CI | VERIFIED narrowly historical R isolated jobs | Eleven jobs successful; production deployment skipped, native/staging gate proof absent. |
| Auto-deployment restrictions and code rollback | PARTIAL prepared source + historical mocked tests | No installed forced SSH account/first actual promotion. Schema-equality guard intentionally refuses migrations. |
| Database rollback | NOT_NEEDED_YET for this audit | No schema/data change occurred. Never automatically restore over live writes after a code failure. |

## Monitoring Acceptance Proposal

Before pilot, assign a real operations owner and escalation backup. Values below are signals to instrument, **not invented alert thresholds or a promise of current installation**.

| Signal | Purpose / privacy | Owner / evidence needed |
| --- | --- | --- |
| HTTP/WS request count, status, duration, route template, replica ID | Detect 401/403/429/5xx and latency per family; never label by phone/contact/JWT/CNIC/raw URL. Opaque correlation ID only. | Operations owner TBD; verify latency/error alerts using a local fake incident. |
| OTP recipient-limit/provider errors and submission uncertainty | Detect abuse/outage without codes/phones or resending uncertain messages. | Auth/operations owner TBD; provider mocks, no live OTP. |
| DB pool/slow query/deadlock/serialization retry | Diagnose availability and contention, not private SQL bind values. | API/DB owner TBD; synthetic query traces/plans. |
| Order age/state/checkout conflicts, duplicate replay and stock/COD anomalies | Detect stalled business operations without double-processing a request. | API/merchant operations TBD; synthetic invariant dashboards. |
| Refund/settlement conflicts and unreconciled cash | Surface bounded/manual reconciliation; don't auto-repair financial records. | Finance owner TBD; approved COD policy and sanitized fixture. |
| Notification pending age/retries/dead letters, push failure | Requires future stable event/outbox; current logs only. | Worker/operations TBD; crash/ack synthetic tests. |
| Disk/free space/backup age/restore drill age | Include public media, private docs, releases and encrypted backup storage. | Infrastructure owner TBD; documented retention and proof. |
| Cert/DNS/API service readiness and optional provider state | Keep optional provider degradation separate from DB/process restart. | Infrastructure owner TBD; read-only scope separately approved. |

Approve a redaction allowlist: authorization, refresh/access tokens, OTP, CNIC, contact/address coordinates, private documents, signed quotes/import tokens, bank details, CSV row content and provider bodies are not raw log fields. Review reverse-proxy and socket query-token logs as well as application logs. Preserve essential opaque order/request/actor references only where authorized and needed for reconciliation; protect audit access and retention.

## Backup And Isolated Restore Acceptance

No backup/restore command was executed in this audit. Under separate authorization:
1. Agree RPO, RTO, encryption/key custody, offsite destination, access control, retention, operator and restore drill frequency. No guessed targets.
2. Inventory database, exact code/artifact/schema version, live configuration, public catalogue/uploads, private merchant documents and any separately managed provider session. Preserve existing WhatsApp authentication; its independently hosted provider has its own recovery scope.
3. Take consistent backups using the existing approved database role/process without printing credentials. Enforce least privilege; files and dumps are sensitive, never Git/CI artifacts/public static files.
4. Verify archive integrity/manifests. A pg_restore --list result is only an archive/list check.
5. Restore into an explicitly named isolated scratch DB/filesystem/service that cannot reach production providers or alter other services. Do not run migration/seed against live data.
6. Validate schema/counts/relationships, order/stock/refund/settlement invariants and files; launch the restored artifact only in approved isolation with notification/OTP transports mocked. Verify guest browse and synthetic role recovery; measure actual recovery time/data age.
7. Keep sanitized restore proof and owner acceptance. Never publish private records, env values, document images or backup keys in this directory.
8. Schedule/alert/retention is accepted only after an approved drill succeeds and failure notifications are proven.

Future deployment helper [deploy/api/promote.py](<C:/Users/tassa/.codex/worktrees/api-icons-release/SirfBazar/deploy/api/promote.py:96>) creates a root-private SirfBazar DB dump/list. It does not itself back up all runtime files, encrypt/offsite-copy the archive, perform a restore or implement recurring retention. Its future existence must not replace this gate.

## Outage And Uncertain-Result Procedure

| Incident | Proposed safe response | Forbidden shortcut |
| --- | --- | --- |
| DB unavailable | Keep business mutations failed closed; alert named owner; recover known service/DB under scoped approval; clients retain uncertain order/sale references. | Seed/reset, make carts/orders public, start old Windows writer or restart unrelated PostgreSQL/services. |
| WhatsApp/provider outage | Keep existing challenges/cooldown/uncertain status; inspect sanitized readiness under approved read-only scope; user can wait/recover via approved methods. | Switch to mock, print API/ADMIN keys, spam resend, delete provider session without approval. |
| Lost checkout/POS/delivery response | Read owned canonical record by saved identity/state; retry only identical approved durable request when valid; reconcile cash explicitly. | Generate a new order ID, call customer confirm endpoint, charge/collect again because network failed. |
| Suspected authentication bypass | Escalate F01/F02; approve narrowly scoped mitigation/config verification; preserve private evidence and reviewed login paths. | Probe real accounts or deploy a blanket auth/UI replacement without approval. |
| Push/WS outage | REST refetch/polling fallback, optional provider alert; eventual outbox replay if implemented with stable IDs. | Repeat committed order/refund actions to get a notification. |
| Financial conflict/legacy COD ambiguity | Hold affected payout/refund for authorized finance reconciliation. | Infer paid cash from delivered/UI state or bulk-adjust historical records during an audit. |
| Disk/backup alert | Stop unsafe promotion/upload under approved policy; retain evidence and operator-managed recovery. | Recursively delete unverified paths, backups, documents or other services' data. |

## Deployment And Rollback Acceptance

Existing prepared workflow: [.github/workflows/ci.yml](<C:/Users/tassa/.codex/worktrees/api-icons-release/SirfBazar/.github/workflows/ci.yml:240>) and [docs/API-AUTO-DEPLOYMENT.md](<C:/Users/tassa/.codex/worktrees/api-icons-release/SirfBazar/docs/API-AUTO-DEPLOYMENT.md:20>). Only approved push on codex/server-api-deployment plus activation variable could deploy; dependencies must pass; host keys pinned, archive manifests validated; schema changes refused; code rollback restores previous pointer without automatically restoring database.

Before ANY future rollout:
1. Owner approves exact source/artifact, critical findings, backup/restore proof, configuration names/presence (not values in logs), maintenance window/checkout-and-catalog write pause, client/APK readiness and test scope.
2. Confirm only SirfBazar service/current pointer/storage are in scope, and other existing APIs/services remain untouched.
3. Drain requests/notification workers/WS according to tested behavior; do not claim current helper already supplies full app drain.
4. Promote only matching quote-compatible clients/API. Source compilation alone does not replace installed APKs. Keep old clients paused until deliberate compatibility policy is tested.
5. Verify non-mutating public reads/CORS/provider readiness under approved scope; private/cart GET requires source review because it may write. Business scenario verification needs separate synthetic fixture permission.
6. Observe named metrics/alerts and release proof. On failure, recover previous *compatible and secure* code artifact with only SirfBazar restart, preserving configuration/data/uploads. Rollback into known F01/F02/payment bypass must be rejected or narrowly gated.
7. If data/schema changed in a separately approved batch, use its reviewed forward/compatibility recovery plan; do not restore a live DB automatically after new orders could arrive.

No activation, DNS, Caddy reload, new account, secret storage, provider configuration or maintenance pause was performed here.

