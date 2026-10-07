# Category and icon release review

8 October 2026. Scope: `codex/unified-icons-mobile-signup`, following reviewed remediation `5bbb965`. This review covers local source and isolated fixtures, not a production deployment or independent specialist sign-off.

## Implemented

- 26 existing departments retained; 123 named subsections planned from the public 2,610-product snapshot. Fresh Fruits and Fresh Vegetables share their existing parent. Chicken, Beef, Mutton and Seafood share Meat & Seafood. Full list: `CATEGORY-SUBSECTIONS.md`.
- Merchant web's three-part catalogue supports expandable subsections, multi-selection across category changes, explicit price/stock per selected product and add-only submission. Existing listings are excluded; partial failures keep the original retry payload and request ID. This does not claim bulk-selection parity in the merchant native app.
- Public catalogue/search, nearby products/shops, public shop products and merchant listing filters include active descendants. Invalid/inactive/cyclic ancestry fails closed. Parent-category coupons continue to recognize child products using the supplied transaction client.
- Customer web has nested filter links and subsection navigation. Child slugs resolve correctly, and invalid categories no longer silently show everything. Customer native category chips expose the selected department's subsections and resolve child headings. Admin category rows display parent sections.
- Guarded plan/apply/rollback tooling preserves product and root IDs, merchant prices/stock, product flags and existing category assignments below roots. Re-importing existing source products no longer flattens their reviewed category assignment.
- Free library icons and merchant native signup work from the preceding icon pass are included; see `ICON-SYSTEM-REVIEW.md` and `THIRD-PARTY-ICONS.md`.

## Executed verification

- Eight category unit/service regression groups passed: deterministic plans, restricted-state inheritance, idempotence, unknown-name review, conflicting targets, active ancestry, five public filter paths and parent-coupon matching.
- Real PostgreSQL 18 test-only database: plan is read-only; backup acknowledgement required; stale plan rejected before writes; a forced audit failure rolls back both category creation and product moves; successful apply preserves listing prices/discounts/stock/SKU and product barcode/approval/prescription/restriction fields; fresh plan is empty; guarded rollback restores assignments and preserves category IDs; repeated rollback refused. No production DB was used.
- Existing 13 database/realtime/upload remediation groups passed on the isolated database after the new changes.
- Mock WhatsApp transport and authentication tests passed; no real messages sent. WhatsApp provider and Prisma schema are unchanged from the live Git baseline. The already-reviewed auth service security changes remain included.
- API, admin, merchant web, standalone POS and all three mobile TypeScript checks passed. Customer Next.js and all three Vite production builds passed. Windows sandbox filesystem errors required rerunning production builds outside the sandbox with the same source.
- Icon adapter tests: 7 passed. Merchant CSV parser tests: 4 passed. Customer suite: 44 passed before the child-heading test; the affected customer-flow suite was rerun with all 12 tests, including the added child-heading regression, passing. Merchant native auth tests: 7 passed; merchant/rider push lifecycle tests: 3 each passed.
- Intercepted merchant browser fixture passed keyboard expansion, child/parent filters, multi-selection persistence, existing-listing exclusion, paisa conversion, exact partial-result retry and desktop/dark/320px layouts. No merchant mutations were sent to live.
- Intercepted customer website fixture checks child slug-to-ID resolution, parent navigation, mobile subsection action, 320px layout and invalid-category fail-closed behavior. Screenshots reviewed locally under `output/playwright/`.
- Updated customer Android JavaScript export passed (3,089 modules). This is not an APK or a real-device test. The initial verification launcher was stopped after a local worker-launch issue; the successful rerun used the direct Expo executable with two workers.

## Interface review (scoped)

The `better-interface` workflow and focused accessibility, layout, writing, typography, color and UI skills guided this review. Native disclosure/link controls were preferred over a custom tree widget. Merchant keeps the existing desktop three-pane pattern; narrow layouts stack in reading order. Customer mobile filters expand in document flow instead of covering or being covered by fixed navigation.

| Domain | Evidence / outcome | Limits |
| --- | --- | --- |
| Accessibility | Native buttons/links/details, named disclosure controls, pressed/expanded states, labelled price/stock fields, keyboard expansion and 44px subsection targets | Screen-reader speech, forced colors and every keyboard path not verified |
| Layout | Merchant desktop + 320px, customer desktop + 320px; no horizontal overflow; mobile bottom-navigation overlap found and repaired | RTL, pseudo-localization and 200% zoom not verified |
| Writing | Explicit parent “includes subcategories,” “Select visible products,” add-only action and row failures; unknown classification goes to reviewed Other section | Not a full translation/copy audit |
| Typography | Existing type system retained; wrapped category names and responsive headings reviewed in screenshots | Dynamic native font scaling not verified |
| Color | Existing theme tokens retained; merchant light/dark screenshots reviewed; states also carry labels and disclosure indicators | No new full contrast audit or native theme screenshot certification |
| UI | Shared library icons, existing spacing/surfaces, separate expand/filter controls, selected-item review preserved | Scanner/printer hardware and native touch rendering not verified |

Verdict: approve the inspected local implementation for repository handoff, with production promotion blocked on the API-host checklist and coordinated compatible clients. No claim that all screens, every product classification or real-device behavior were exhaustively verified.

## Release holds and warnings

- API is hosted on another laptop. The user will run `API-UPDATE.md` there through Codex. Keep `master`/production frontends unchanged until backend readiness and the checkout cutover are coordinated.
- The host must generate and review its OWN plan. Public snapshot counts are not production assertions; product-name classification remains reviewable and can require correction for future items.
- The API now requires approved checkout quotes; old clients need a coordinated release or agreed maintenance window. Do not weaken the guard to bypass that dependency.
- Installed mobile apps still need new APKs; no APK build, installation or production native checkout test was performed in this category pass.
- Local runtime is Node 24; the host/CI release target is Node 22. Recheck on that target before promotion. Existing Next React 18 deprecation and merchant bundle-size warning remain.
- A rollback deactivates only newly created empty subsections rather than deleting IDs. Later product/category/coupon changes can make automatic rollback refuse; preserve the audit, plan and backup for reconciliation.
