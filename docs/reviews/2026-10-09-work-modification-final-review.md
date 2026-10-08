# Work modification: final review — 9 October 2026

ATeam run `20261008T155332Z`; branch `codex/work-modification-20261008-ateam`; source baseline `f308e2e09372add6594d6b85f4c3070b78441dc8`. Changes are local and uncommitted. Independent review returned PASS WITH WARNINGS, detailed below. This document is evidence, not deployment approval.

## Release state

- Implementation and independent QA have completed. The final human review gate has not been approved.
- No commit, push, pull request, production deployment, new signed APK or device installation occurred in this run.
- The local `origin/master` reference was `1684881` during review, but direct `git ls-remote` plus the GitHub PR API before release confirm remote master is `66f5b536113a8493199bee69ece81de9913b3eea`. The release PR also carries three existing reviewed documentation commits. Use the remote PR/CI state, not the stale local reference, to establish merge readiness.
- Existing live environment configuration, Prisma schema, API bootstrap module and WhatsApp provider implementations are untouched. No live OTP, payment, push, customer order, inventory or database mutation was used for verification.

## Eight requested modifications

| Request | Implemented and locally checked |
| --- | --- |
| 1. Shop setup map | Configured Google map retained; key-free Leaflet fallback, GPS/manual recovery, keyboard centre selection and map help. Component-scoped CSS fixes the invisible signup map. Profile map sits above the edit drawer and restores focus. |
| 2. Shop open/closed toggle | Permission-aware switch shows server-confirmed availability, a busy state and accessible labels. Unauthorized staff cannot submit the change; ambiguous responses recheck the server. |
| 3. Old rider notification in a new shop | New notifications are scoped to audience and tenant across HTTP, sockets and push. Old unversioned messages are in a separate Earlier account notifications view and excluded from current badges. |
| 4. Customer category subsections | Parent/child category controls filter related products, preserve search/sort/type URL state and handle old category links. Merchant catalogue keeps its approved design. |
| 5. Dark mode and sliders | Theme-safe shop cards; controlled category/product rails with arrows, touch and keyboard navigation, end states and reduced-motion support. Categories appear before Everyday essentials. |
| 6. Messages as toasts | Transient action feedback uses friendly floating toasts across seven clients, with fullscreen/dialog support and account-generation fences. Form validation, load Retry and durable uncertain-order/POS recovery deliberately remain in context. |
| 7. Catalogue Load more | Bounded 24-item append, deduplication, stale-filter response rejection and retained cross-category selected items/prices. Immutable bulk-request identity survives partial retries. |
| 8. Customer sign-in/signup | Selected variant A: one Sign in or create an account sheet, official Google option and existing WhatsApp OTP, single six-digit field, focus trap/autofocus, configured resend cooldown, expiry and clear incorrect-code copy. Guest basket and uncertain merge recovery retained. |

Additional E1–E6 repairs cover rider account eligibility, one-use refresh rotation, coherent client sessions, atomic basket/inventory and address handling, safe cancellation/return review, restricted audited admin status repairs and notification-registration ownership/audits. Exact paisa formatting is consistent across money displays. Existing duplicate-checkout/refund/settlement safeguards were exercised again.

## Executed checks

These are local manual checks on the final source, not an executed GitHub Actions run.

| Check | Result and boundary |
| --- | --- |
| Clean lockfile installs | All eight apps passed `npm ci` during this run. Installs used system Node 24; web reported its Node 22 engine preference. Actual final compilations used Node 22.23.3. |
| TypeScript | All eight apps passed `tsc --noEmit`. |
| Web builds | Customer Next webpack build and merchant/admin/POS Vite builds passed under Node 22. Admin/POS used `--configLoader runner` to avoid a Windows esbuild parent-directory access error. Sandbox-denied generated Next directory creation was retried successfully with escalation. |
| Mobile compilation | Customer, merchant and rider Expo Android Hermes bundle exports passed from the updated installed lockfiles. These are JavaScript exports, not APKs or native/device tests. |
| API unit/service mocks | 14/14 passed, including real approved-quote checkout fixtures and configured OTP cooldown metadata. |
| Disposable PostgreSQL | 26/26 passed on guarded local `sirfbazar_remediation_test`, port 15449. Includes barriered checkout/address races, guest merge/add races, refresh/registration transfer, account eligibility, cancellation/stock, payment/refund/settlement and audit rollback. No API server or schema migration was started. |
| Browser transport | 86/86 passed against actual client adapters, including late account responses, cross-tab refresh and merchant mutation no-auto-replay. |
| Native transport | 33/33 passed against actual client adapters/pure session modules, including queued credential writes, refresh and invalidation. Not device evidence. |
| Owner-bound toasts | 33/33 passed across the seven clients. |
| Component feedback bridge | 8/8 passed: stale login/signup/address callbacks suppressed; current errors visible; own post-login basket-merge uncertainty retained. |
| Exact money | 36 behavioral cases passed. |
| Client regression suites | Customer web 9; standalone POS 3; customer mobile 48; merchant mobile 7 plus push lifecycle 3; rider mobile 3 plus push lifecycle 5; merchant web iPOS/alerts/import/categories 23. All passed. |
| Final browser journeys | Rebuilt local previews passed checkout/address/map, POS/iPOS recovery, scanner focus, drawer layering, catalogue selection/bulk retry/CSV, signup OTP, friendly errors and category responsiveness. API requests mocked; external providers blocked. Widths covered include 320/390/720/768/1024/1440 where relevant. |
| Independent final auth QA | Incorrect OTP copy, resend cooldown/explicit resend, expired-code disabled verification, retained uncertain guest merge, autofocus and light/dark 320px reflow passed. Legal/basket notes are 12px/16px. |
| Deployment helper checks | Node health/release helpers 14/14 passed. Python deployment helpers: 16 passed, 4 Linux-only tests skipped on Windows. Linux cutover/rollback verification awaits CI. |
| Git whitespace | `git diff --check` passed. Generated native exports are ignored and are not release source. |

The interface skills influenced keyboard/focus, narrow-screen reflow, dark-mode surfaces and readable support copy. Rendered dark shop-card contrast measured 14.86:1 primary and 8.73:1 secondary text; reduced-motion rails scroll instantly. Evidence screenshots are local ignored verification artifacts under `output/playwright/`, including `review-final-otp-401-dark320.png` and `review-final-otp-expired-light320.png`.

## Remaining warnings and unverified gates

1. **Native dependency risk is not eliminated.** Fresh `npm audit --omit=dev` reports 39 advisories per native app: 16 moderate, 23 high, zero critical. Compatible current-major patches were applied, and Expo/RN patch alignment was verified by successful exports. Remaining Metro/Expo/RN/signing/build dependency chains need a separately validated framework upgrade or explicit risk disposition. Do not claim a clean audit or release new mobile binaries as fully certified.
2. **API audit:** five moderate findings, zero high/critical. The Nest dependency chain includes an [SSE newline-injection advisory](https://github.com/advisories/GHSA-36xv-jgw5-4q75); the patch is in a newer major line. No `@Sse` endpoint was found in this API, so direct exposure was not identified; that is a source-based inference, not elimination of the advisory. Customer web, merchant web, admin and standalone POS production audits report zero findings.
3. **Physical mobile tests/APKs:** no Android device is listed by ADB. No new signed APK, native Android/iOS build, device GPS, foreground/background/cold-start push, native Google or installed-app navigation test occurred. Preserve the separate native release gate.
4. **Staging/providers:** the isolated staging journey and real configured Google/WhatsApp/push delivery were not executed. Mocked provider behavior is not delivery proof. Production configuration and production deployment identity are not verified by local checks.
5. **Legacy notifications:** all pre-versioned rows are conservatively classified as Earlier. Historical inference for provably unambiguous rows remains unimplemented. No production historical records were rewritten.
6. **Persistent mobile-width toast:** at 320px, the OTP error toast can cover resend/legal controls until its visible Dismiss is pressed; QA confirmed the controls work after dismissal. This is a remaining presentation warning.
7. **Other bounded behavior:** notification read-all is transactionally limited to 20 pages of 500 rows; larger histories require a future batch design. Post-pickup returns require physical review, not unconditional restocking. Background GPS scope and exhaustive staff-permission-removal/device history scenarios are not certified.
8. **Build warnings:** merchant bundle-size warning and React 18/Next deprecation remain. No forced framework downgrade/major upgrade or automatic `npm audit fix --force` was applied.

## ATeam gate and next release steps

The saved ATeam configuration has no stage verification command and no detected final verification commands (`policy: unverified`). The manually executed evidence above must not be presented as ATeam automatic certification. After the human review gate is approved, follow the skill's final-verification step, explicitly surface that warning, and recheck the exact release source as appropriate.

Then commit only intended source/docs/lockfiles, push the isolated branch, attach any created pull request, wait for protected-master CI (including Linux deployment packaging and transaction checks), and follow the existing guarded master release workflow. A pushed branch is not a live deployment. Verify the deployed API and web revisions/health after release; keep mobile binary/device approval separate. Do not change production secrets, providers or schema to make a check pass.

## Independent review verdict

**PASS WITH WARNINGS.** No remaining BLOCK was found in the bounded source review.

The independent reviewer reran browser transport 86/86, native transport 33/33, owner-toast 33/33 and component bridge 8/8. Late feedback ownership checks were verified in customer web `LoginSheet.tsx:88/116/140`, merchant `SignupFlowPage.tsx:215/233`, and native `AddressesScreen.tsx:46/55`. The deliberate post-sign-in generation capture in `LoginSheet.tsx:112/136` retains the new account's own uncertain basket-merge recovery rather than suppressing it. Merchant origin fencing and no-automatic-mutation replay remain intact.

The reviewer accepts the 320px persistent-toast overlap as a minor presentation WARN because visible Dismiss restores access. Native/API dependency advisories, conservative legacy notifications, device/APK/staging/provider gaps and Linux-only deployment checks remain WARNs requiring their own disposition. CI configuration is not executed CI evidence. This verdict supports human source acceptance only; it is not production or native release certification.

The user approved this final review on 9 October 2026 and requested live deployment plus installable customer, merchant and rider APKs. Approval does not turn the recorded dependency/device/staging warnings into passed checks. Proceed through protected CI and preserve the existing signing identity; record actual deployment and APK outcomes separately.
