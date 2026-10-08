# Pilot And Release Gates

Date: 2026-10-08. **Phase 0 audit complete, readiness not certified.** These are acceptance criteria, not new permissions. No later phase is approved.

## Audit Exit Gate

| Gate | Status | Evidence / hold |
| --- | --- | --- |
| Existing instructions and supplied brief read | VERIFIED for audit execution | Local file/source reads; Phase 0 scope overrides deployment/install instructions in older records. |
| App inventory and actual route comparison | VERIFIED for static inventory | Eight apps/shared layers, 189 L / 191 R, all 175 historical routes retained + 16 additions. |
| Source paths/test/configuration unknowns classified | VERIFIED as documentation completeness | AUDIT, APP_COVERAGE, ENDPOINT_CONTROLS, DECISIONS, TEST_EVIDENCE and runbook; not runtime control certification. |
| Prioritized findings / minimal tests / compatibility / rollback | VERIFIED as proposal presence | F01-F14 and IMPLEMENTATION_PLAN B1-B11. No batch approved. |
| Source/config/production preserved | VERIFIED for local audit boundary | Docs-only changes; existing ZIP preserved, no runtime tests/mutations/install/migration/deploy. |
| Owner approves B1 scope and tests | UNVERIFIED / pending | Stop here. This is the next approval, not implementation permission inferred from earlier cutover. |

## Pre-Pilot Blockers And Acceptance

| Gate | Status / priority | Evidence required before acceptance |
| --- | --- | --- |
| No public existing-credential overwrite | PARTIAL / P0 F01 | Approved B1 source review + synthetic existing staff/customer/admin/owner/conflict/race tests; authenticated recovery/new signup still works. |
| No production Google/mock/signing misconfiguration | PARTIAL + live UNVERIFIED / F02/F14 | Fail-closed mock/unknown provider, approved audiences/claims/timeouts/signing config; securely record presence/mode without keys; native/web sign-in compatibility. |
| Correct tenant/staff/private document access | PARTIAL / P1 F03 | All endpoint actor/ID/nested tests incl. same-merchant unauthorized staff, removed membership and non-public document headers/projection. |
| HTTP/WS abuse budgets and correct proxy keying | PARTIAL / P1 F04 | Explicit family numeric units/burst/cost/keys/trusted hops/storage/Retry-After/outage policy; T05-T08/T25 isolated proof. Preserve existing OTP fences. |
| Atomic refresh + all-client session/cache fencing | PARTIAL / P1 F05/F06 | Single token race/reuse/lost response; late logout/switch/demotion writes across all seven clients; private cache cleared/fenced, no destructive guest/purchase-marker loss. |
| Safe native credentials | PARTIAL / P1 F07 | Keep verified customer migration; approved merchant/rider migration; storage-failure/logout/upgrade/restart/old APK policy plus real native tests. |
| Durable notification effects and drain | PARTIAL / P1 F08 | Approved outbox/event identity/lease/retry/dead-letter/crash tests; provider uncertainty policy; no provider I/O inside domain transaction. |
| Safe uploads/import/content/egress | PARTIAL / P1 F09/F10 | Actual signatures/dimensions/extensions, private/public split, quotas; no arbitrary push destination egress; hostile fixture tests, preservation of approved assets. |
| Cart/order/stock/assignment/completion invariants | PARTIAL / P1 F11/REL | T09-T16 including different cart sessions/edits, last unit, cancel/reject/sweeper and rider dispatch/kill/relaunch; state replay/reconciliation prevents a second collection. |
| Enabled payment method authority | PARTIAL / P1 MONEY | COD policy signed by owner/finance, actual cash/fee/discount/refund/settlement reconciliation fixture. Keep online simulation denied; provider/callback gates mandatory if enabling digital payments. |
| Query/resource bounds sufficient for pilot | PARTIAL / P1 bounds, P2 tuning | Search/radius/coordinate/content bounds and safe query behavior; measured synthetic plans/payload/latencies. No invented performance sign-off; Bloom not a blocker. |
| Monitoring and incident ownership | PARTIAL + deployment UNVERIFIED / P1 F12 | Correlation/redaction, process/DB/optional-dependency health, alert signals with named owner and proven delivery; simulated incidents. |
| Full backup/restore | UNVERIFIED / P1 F12 | Approved RPO/RTO/retention/encryption/offsite/access; isolated DB+config+public/private-files restore, application validation and measured recovery evidence. |
| Controlled release/rollback | PARTIAL / P1 OPS | Exact compatible artifacts/client versions, secure code rollback and drain rehearsal, separate deployment approval. Auto-deployment remains intentionally disabled unless reauthorized. |
| Design/theme/accessibility retained | PARTIAL / CLIENT-03 | Existing approved layouts/assets/theme behavior; all applicable Light/Dark/System, keyboard/error/permission/reflow screens plus real device acceptance. No replacement apps. |
| Full synthetic cross-app pilot journey | UNVERIFIED / T31 | Guest browse/cart → approved sign-in/merge/quote → order → merchant fulfillment/assignment → rider completion/COD → receipt/refund/settlement/support/relaunch; exact artifact/fixture/provider scope and retained private evidence. |

## Conditional Gates

- Digital payment provider callbacks: NOT_NEEDED_YET for current COD-only operation; a blocker before enabling any real online method.
- Negative cache and Bloom: NOT_NEEDED_YET. Absence is not a production defect or an installation task. If approved after measurement, T20-T23 become relevant acceptance.
- Background rider tracking: NOT_NEEDED_YET unless explicitly promised/approved. Current foreground tracking is preserved and still needs physical-device acceptance.
- Production security/load tests: NOT_NEEDED_YET in Phase 0; any later capacity/security exercise requires an approved nonproduction scope first, never implied production testing.
- Auto-deploy activation: not an audit-completion requirement; the user's preparation-only choice remains binding.

## Release Decision Record To Complete Later

Owner/reviewer: pending. Exact commit and client artifacts: pending. Maintenance pause/client retirement policy: pending. Native/staging scope and results: pending. Finance policy: pending. Restore/rollback proof: pending. Infrastructure/provider approvals: pending. Accepted residual risks and expiry/recheck date: pending.

The successful historical isolated CI is useful but insufficient to close these gates. A report, startup log, build, mocked API screenshot or branch push is not proof of production correctness. **Do not deploy or start B1 until approval is received.**

