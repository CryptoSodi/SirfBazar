# Test Evidence And Scenario Coverage

Date: 2026-10-08. Phase 0 audit only. **No app test, build, seed, migration, provider request, production request or load/security test was executed during this audit.**

## Evidence Provenance

| Evidence | Version/environment | Result | Limit |
| --- | --- | --- | --- |
| Read-only git status, log/ref/worktree and source diffs | L 33275a4; R 6c316b0 | Main starts with only untracked tools/grocerapp-scraper.zip. No API source/schema diff from historical deployed 1ab4208 to R. Git worktree/ref metadata confirms both commits. | No fetch/current remote or running server verification. Final R status/diff against filesystem returned "must be run in a work tree" despite valid rev-parse metadata; see independent file comparison below. |
| File-to-commit blob comparison | R filesystem vs Git tree 6c316b0; read-only Node fs/crypto and RTK git ls-tree | 477 tracked text source/config/instruction/script files in apps, deploy/api, .github, scripts and AGENTS.md matched committed Git blob hashes (CRLF normalized where required); no missing/mismatching file. All eight lockfiles present in both checkouts. | This verifies inspected source provenance despite R status-command limitation; not untracked/binary/runtime/provider/deployed filesystem verification. No Git configuration/index repair attempted. |
| TypeScript AST controller scan using already-installed parser | Source files only, both checkouts | 189 L and 191 R routes; brief 175 all matched R; 16 additions, zero removed/renamed paths. | No application import/bootstrap/network; inventory, not runtime enforcement. |
| Static file/manifest/test/source/instruction reads via RTK | Local workspace/worktree and supplied brief | Eight app manifests/shared layer, critical backend/client controls and existing test scope inspected. | Some searches were truncated or referenced wrong file names; findings use subsequent focused source/line reads. A failed search is not a missing-control conclusion. |
| Documentation-only validation | Eight saved reports; file-only Node assertions and main Git status/diff | All 324 local references exist with valid cited line numbers; 191 distinct endpoint rows include all 175 baseline routes; 32 scenario rows; all eight apps represented. Main tracked diff is empty; new audit directory plus preexisting scraper ZIP are untracked. | Documentation integrity, not application execution or production-readiness verification. |
| Previously observed GitHub CI [run 37718287262](https://github.com/CryptoSodi/SirfBazar/actions/runs/37718287262) | Exact R 6c316b0; isolated Linux Node 22, disposable PostgreSQL; prior task | Eleven test/build jobs succeeded; deploy-api skipped. This observation precedes Phase 0, not re-fetched or rerun now. | No current production/native-device/provider/capacity proof. Build-only fixture secrets/mocks are not production configurations. |
| Prior remediation review/checks | Earlier 7 October reviewed source, docs/remediation-final-review-2026-10-07.md | Records 13 database/realtime/HTTP groups and 12 intercepted browser journey groups after repairs. Current matching source/tests inspected. | Earlier statements that these fixes were not deployed are historical; do not infer current service state from that report. |

No current environment secret values were read/copied into these reports. No new credentials were created.

## Existing Test Implementations Reviewed

| File / runner | Test mechanism / evidence | Boundary |
| --- | --- | --- |
| [apps/api/test/remediation-database.test.cjs](<C:/Users/tassa/.codex/worktrees/api-icons-release/SirfBazar/apps/api/test/remediation-database.test.cjs:66>) | Disposable PostgreSQL: signed quote/replay/last stock, torn listing, atomic refund/cancel, parent COD allocation, concurrent settlement/hold/pay, delivery/COD total, support/location/OTP privacy and bulk row retry. Historical CI pass. | Service-level fixture tests, not all actual HTTP roles/replicas. Runner validates separate test database. |
| [apps/api/test/remediation-realtime.test.cjs](<C:/Users/tassa/.codex/worktrees/api-icons-release/SirfBazar/apps/api/test/remediation-realtime.test.cjs:14>) | Mocked socket emission rechecks session/membership/assignment/permissions and query failure. Historical CI pass. | Not full real Socket.IO handshake/load/fanout/replica/device test. |
| [apps/api/test/remediation-upload.test.cjs](<C:/Users/tassa/.codex/worktrees/api-icons-release/SirfBazar/apps/api/test/remediation-upload.test.cjs:22>) | Isolated Nest HTTP boot, malformed/oversized/aborted multipart and scoped bulk body. Historical CI pass. | No hostile byte decoding/dimensions or full 1,000-row load proof. |
| [apps/api/test/pos-counter.test.cjs](<C:/Users/tassa/.codex/worktrees/api-icons-release/SirfBazar/apps/api/test/pos-counter.test.cjs:44>) | Mock transaction fixtures: sale replay, tenant/cashier/intent, late concurrent commit recovery, financial-audit rollback, exact barcode and permission. Historical CI pass. | Does not replace real database contention/hardware acceptance. |
| [apps/api/test/whatsapp-auth.ts](<C:/Users/tassa/.codex/worktrees/api-icons-release/SirfBazar/apps/api/test/whatsapp-auth.ts:67>) / test:whatsapp | In-memory storage/fake provider: production mock factory/default refusal, hashing/expiry/master-code rejection, normalized concurrent sends, concurrent capped wrong attempts/single-use verification, cooldown/hour budget, uncertain/failed submissions, resend invalidation, new registration and password-reset OTP replay. Historical CI pass. | Not real PostgreSQL two-process/outage proof. Existing-identity registration overwrite cases F01 are not established by the new-account fixture. No messages sent. |
| [apps/api/test/smoke.ts](<C:/Users/tassa/.codex/worktrees/api-icons-release/SirfBazar/apps/api/test/smoke.ts:280>) | Historical isolated packaged API HTTP smoke: digital quote and customer initiate/confirm/fail return 400; order list unchanged. | Narrow fail-closed behavior, not genuine provider callbacks or all actors. This record does not authorize running the mutating smoke script in Phase 0. |
| API test:waha/test:whatsapp transport/test:bind/category-sections | Provider mocks, sanitized responses, bind behavior, category ownership/structure. Historical CI pass. | Do not invoke live send scripts, WhatsApp readiness or category imports as “tests” here. |
| [apps/customer-app/test/customer-flow.test.cjs](<C:/Users/tassa/.codex/worktrees/api-icons-release/SirfBazar/apps/customer-app/test/customer-flow.test.cjs:65>) | Transpiled isolated harness: delayed refresh, concurrency/offline, merge retry, SecureStore migration/logout/failure. Historical CI pass. | Mock native/platform/provider APIs, not installed phone app behavior. |
| Customer checkout-draft/reference/product-purchase tests | Saved draft/quote identity, location/appearance/public auth and product eligibility/pending additions. Historical CI pass. | Fixture-level state, not actual payment/delivery. |
| Web checkout-recovery / POS sale-recovery | Node fixtures for owner-bound saved uncertain attempt, exact payload and definitive no-write classification. Historical CI pass. | Browser storage/account changes and HTTP recovery need additional tests. |
| Shop alert/iPOS/bulk tests | Node fixture workflow/contract checks. Historical CI pass. | Actual proprietary CSV export schema/scanner/printer unverified. |
| Merchant auth-flow + scripts/test-push-lifecycle.cjs | Mock push/session-binding permission and logout/account-switch cases; native typechecks all three. Historical CI pass. | No native order/GPS/secure migration acceptance; rider app package test runs push lifecycle, not complete delivery. |
| [scripts/browser-remediation.mjs](<C:/Users/tassa/.codex/worktrees/api-icons-release/SirfBazar/scripts/browser-remediation.mjs:1>) | Local isolated clients; intercepted API; checkout/address/map/focus, POS recovery, merchant bulk/signup/recovery/toasts, 320px. Historical CI pass. | No real registration, order/provider, map tile or production mutation. |
| [deploy/api/test_deploy.py](<C:/Users/tassa/.codex/worktrees/api-icons-release/SirfBazar/deploy/api/test_deploy.py:1>) and healthcheck.test.cjs | 17 Python archive/parser/schema/promotion/rollback tests plus five Node mocked health checks recorded in preceding task. Linux CI checks installer syntax/real API packaging. | No server account installation, SSH enforcement, full restore or real auto-promotion. |
| [scripts/native-remediation.mjs](<C:/Users/tassa/.codex/worktrees/api-icons-release/SirfBazar/scripts/native-remediation.mjs:1>) / staging-remediation.mjs | Configured optional release gates only; requires separate fixtures/builds/access. | UNVERIFIED; staging runner can mutate quote/rejection fixtures and is not audit-safe to execute without approval. |
| Admin | Historical TypeScript/Vite build, no dedicated test script in manifest. | All admin role navigation/action recovery/theme/device checks remain unverified. |

## Commands And Safety Classification

Actually run during Phase 0: `rtk proxy git status/log/worktree/diff/ls-files`, `rtk proxy rg --files`, `rtk proxy rg -n`, and inline `rtk proxy node -e` using fs/JSON/TypeScript AST for file-only inspection. One initial nested PowerShell quoting/read attempt failed; later Node source reads supplied evidence. Documentation was written with apply_patch. Final verification uses file-only assertions and git diff/status, not imports/tests.

During final evidence review, unqualified RTK proxy commands encountered a local native-MXC launcher error. Read-only `rtk read`, `rtk git` and proxy calls with the absolute installed Node executable completed successfully. No runtime/toolchain configuration was changed to work around this limitation.

The following are **proposed commands, NOT executed in Phase 0**. First inspect imports/env and use an approved isolated copy with fake providers:
- Narrow B1 synthetic auth test command, to be finalized when its approved test file exists.
- `rtk proxy npm run typecheck` for selected app only after confirming isolated tooling/output.
- `rtk proxy node scripts/verify-remediation.mjs` for default isolated suite, after import/env review.
- Database/browser/native/staging modes only with separate approved synthetic environments; never the live/local shared API URL.
- Existing `smoke`, `seed*`, `test:merchant-*`, `test:realtime-order`, live-gateway and category/import scripts can create records/send messages. They are **not safe Phase 0 checks** and were not run.

Package/dependency installation, npm audit network checks, launching servers/clients and physical-device interaction were not performed. Missing runtime evidence is UNVERIFIED, not a failed test.

## T01-T32 Coverage

Every row states the source/historical evidence and residual scope. VERIFIED is limited to that specific historical isolated case. None is production-certified.

| Scenario | Required invariant | Status | Evidence | Remaining test / blocker |
| --- | --- | --- | --- | --- |
| T01 | Guest browse/cart, private orders | PARTIAL | Public catalogue/guest ownership source; historical smoke/browser reads. | No anonymous/private-role negative coverage for every route; cart GET writes possible. |
| T02 | Foreign/nested IDs and documents | PARTIAL | DB regression tenancy/support/location/OTP subset; service owner filters. | Document permission F03; full addresses/cart/order/item/rider/document actor matrix unverified. |
| T03 | Restricted/removed staff | PARTIAL | AccessService permissions, owner-only staff management; realtime revoked-permission regression; POS permission unit. | Every endpoint, same-shop document/cache/role demotion and HTTP actor matrix incomplete. |
| T04 | Inactive/unapproved rider | PARTIAL | JWT active-rider filter, assigned rider conditional APPROVED, location approval checks. | Uniform pending/suspended profile/action policy and races/device UI not fully tested. |
| T05 | OTP burst/replay | PARTIAL | DB recipient/attempt/consume source; historical in-memory normalized concurrent sends, capped attempts, single-use concurrent verification, cooldown/hour budget and uncertain-send tests. | Real PostgreSQL two-process cooldown/verification, database outage and login/IP budget tests not established; no real OTP sent. |
| T06 | Proxy spoof/NAT | UNVERIFIED | No deployment trust-hop configuration reviewed. | Approved trusted peers/headers and synthetic proxy/NAT fixture required. |
| T07 | Two API replicas | UNVERIFIED | OTP creation uses PostgreSQL advisory transaction lock. | No two running instances exercised; general limiter/provider/WS shared-state behavior unverified. |
| T08 | Limiter storage outage | UNVERIFIED | Recipient OTP DB fence exists; general limiter absent. | No explicit general outage policy or injected storage-failure evidence. |
| T09 | Same-key checkout concurrency | VERIFIED (narrow) | Historical disposable DB checkout regression: owned exact ID replay, one stock claim. | Not proof of multi-instance HTTP transport/lease/all-client behavior. |
| T10 | Changed intent/different keys same cart | PARTIAL | Source signed intent/audit + conditional cart claim; checkout regression subset. | Full different-key simultaneous same-cart/actor conflict matrix and old caller behavior unverified. |
| T11 | Lost checkout response | PARTIAL | Historical web/POS browser fixtures + saved reference tests; native saved draft/source. | Not genuine staging purchase/drop-response/relaunch on all real clients. |
| T12 | Merge races/partial writes | PARTIAL | Source MERGED conditional claim + copy transaction; customer failed-merge retry unit. | Different guest carts, first active-cart creation and edit-vs-merge concurrency unverified, F11. |
| T13 | Last inventory unit | VERIFIED (narrow) | Historical DB checkout/POS stock regression plus torn-snapshot guard. | New stock/checkout variants/replicas and measured contention not certified. |
| T14 | Cancel/reject/sweeper race | PARTIAL | Historical paid-cancel transaction/notification failure regression; conditional status/restoration source. | Simultaneous cancellation/rejection/timer crash/restart and full admin override policy unverified. |
| T15 | Rider assignment race | PARTIAL | Serializable rider IDLE+APPROVED/currentOrder claim and order state source. | No dedicated two-dispatch/assignment collision/active suspension scenario demonstrated. |
| T16 | Delivery retry/crash | PARTIAL | Historical production master-OTP rejection, mixed/single-shop COD total regressions. | Kill during commit/response, duplicate completion receipt, second physical cash collection and native relaunch unverified. |
| T17 | Forged/duplicate/out-of-order payments | PARTIAL | Historical isolated R HTTP smoke verifies digital quote/initiate/confirm/fail return 400 without creating an order; real callback not implemented. | Online provider callback scenarios NOT_NEEDED_YET while digital payments disabled; required before enabling. L self-confirm defect is resolved in R. |
| T18 | Multi-shop COD/refunds/settlements | PARTIAL | Historical mixed collected-child refund allocation, concurrent wallet refund and settlement hold/pay regressions. | Owner fee/discount/cash-hand-off policy, all combinations and legacy reconciliation unverified. |
| T19 | Worker crash/send acknowledgement | UNVERIFIED | Post-commit notification/inbox source traced; no durable outbox. | No kill/restart/retry/lease/dead-letter test; providers not contacted. |
| T20 | Cross-user caches/403/404 | PARTIAL | Shop scoped success cache/invalidation; customer native session tests; server owner filters. | Late private writes/current-scope cache key/permission change and actual HTTP edge no-store behavior unverified. |
| T21 | Negative miss then publication | NOT_NEEDED_YET | No negative response cache traced. | Test required if authoritative public-only miss cache is later justified. |
| T22 | Cold cache/outage/stampede | UNVERIFIED | No backend response-cache outage policy or measured bottleneck. | If cache added, test fallthrough/single-flight/TTL/invalidation with bounded cardinality; don't infer need. |
| T23 | Bloom cold/stale/rebuild | NOT_NEEDED_YET | No Bloom installed; no measured justification. | Conditional tests only if later approved; stale negatives cannot become authority. |
| T24 | Logout during refresh/account switch | PARTIAL | Historical customer native old-refresh/concurrent-refresh/storage/logout tests; fake push lifecycle tests. | Web/admin/shop/POS and merchant/rider full persistence/request/cache races incomplete; server rotation F05. |
| T25 | Forged/revoked sockets/reconnect | PARTIAL | Historical mocked emission authority/revocation tests; customer/shop reconnect-refetch source. | Full handshake/join transport race/budgets/expiry/two-replica missed-events tests unverified. |
| T26 | Rider location/maps/permissions | PARTIAL | Active assigned foreground watcher/cleanup and API location ownership source; DB location tenancy subset. | Physical GPS, home background polling, permission downgrade/device battery/network transitions unverified. No background GPS promise. |
| T27 | SecureStore migration/restart | PARTIAL | Historical customer mock storage migration success/failure/logout race tests. | Merchant/rider implementation missing; native Keychain/Keystore restart/upgrade/downgrade not verified. |
| T28 | Hostile/oversized uploads/imports | PARTIAL | Historical malformed/oversized/aborted multipart and scoped JSON-body regression; bulk per-row stale/retry tests. | Signature/dimension/active content/quota/SSRF/full 1,000-row database concurrency not tested; byte boundary is not load proof. |
| T29 | Theme/keyboard/error states | PARTIAL | Historical intercepted browser modal/focus/320px/map/toast groups; customer appearance unit; design/source checks. | All native screens/light-dark-system, speech/zoom/real map key/hardware unverified; no Phase 0 screenshots taken. |
| T30 | Restore/rollback/old clients | UNVERIFIED | Historical deployment-helper mocked rollback and archive tests; dump/list guide/source. | No full DB+files restore, live helper activation, drained restart, compatible old APK journey or recovery-time evidence. |
| T31 | Full cross-app journey/relaunch | UNVERIFIED | All eight apps built/typechecked historically, selected service and intercepted browser fixtures. | No authoritative end-to-end purchase→merchant→rider→COD/refund/settlement across real devices/relaunch. |
| T32 | Sensitive logs/serialization | PARTIAL | WhatsApp sanitization mocks, selected user projections and HTTP OTP interceptor tests. | All roles/nested payloads/app logs/provider URLs/query tokens/edge logs/support/CSV redaction not certified. |

## Future Evidence Requirements

Record exact commit/app artifact, OS/device/build, fixture ownership/database name, sanitized command, test result/artifacts, and which control/actor/endpoint it verifies. A test that is skipped, has unavailable credentials/device or intercepts API data is not staging/production verification.

Use synthetic accounts/resources, fake OTP/push/payment transports, deliberately delayed responses and controlled failures. Verify environment allowlists before starting application imports/schedulers. Any production observation, provider message, security/capacity exercise or data repair requires a new explicit scope/approval. No test account or demo credential from older notes was used.
