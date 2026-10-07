# Merchant iPOS workspace

## Scope and interaction plan

Add an iPOS icon/link inside the existing merchant dashboard (`apps/shop`), using its authenticated session and theme. The counter is a responsive, classic bill-table workspace rather than a separate login or embedded iframe. Register, held bills, sales history and settings are available through visible navigation buttons.

State plan: loading/permission failure -> ready register -> draft/held bill -> explicit cash payment -> submitting -> saved receipt, rejected input or uncertain result. Uncertain results retain the exact request ID and payload; only checking/retrying that request is allowed until resolved. Scanner Enter only submits the barcode field, never the payment form. Destructive draft removal requires confirmation. Drafts and counter preferences are explicitly local to this browser, account and shop; completing a sale requires the API.

Settings groups: counter identity, billing behavior, scanner input/test, receipt layout, keyboard commands, payments, access and integration status. Only implemented preferences are editable. Offline completion, arbitrary printer/drawer drivers, scale integration, digital tender, fiscal integration and accounting-grade shift closing are not represented as enabled services.

Backend changes are constrained to the existing POS module: capability discovery, exact merchant barcode/SKU lookup and repeat-safe cash sale using the existing Order primary key. Financial request metadata/tender is recorded atomically in the existing audit log; no schema change or database push. Existing clients remain supported.

## Implemented

Follow-up (7 October 2026): see [Classic counter and shortcut compatibility](merchant-ipos-classic.md)
for the appearance toggle, reference-specific/custom keys, direct and multi-quantity,
void-by-scan, reset/exit confirmations and the latest verification. The original
shortcut list below describes the retained **SirfBazar** profile only.

- Left merchant sidebar: monitor/POS icon, **iPOS**, route `/ipos`; lazy-loaded within the existing dashboard.
- Register: exact barcode/shop-SKU scans, leading zeros preserved, serialized repeat scans, product search, whole-unit quantity controls, explicit item/bill removal confirmation, price refresh and stock validation.
- Bills: browser/account/shop-scoped drafts, up to 20 held bills, recall, persistence before submitting payment, exclusive writable-tab lock. Held bills do not reserve stock.
- Cash: explicit tender and change in integer paisa, authenticated server sale, atomic inventory/audit writes, stable UUID retry reference, frozen pending bill after unknown outcomes, receipt recovery and history/reprinting.
- Settings: counter name, stock/code visibility, repeated-scan behavior, Enter/Tab scanner suffix and input test, 58/80 mm receipt width/footer, keyboard enablement/help, payment/access/hardware capability descriptions. Local editable preferences have an explicit save and unsaved-change warning.
- Keyboard: F2 scan, F6 hold, F7 held bills, F8 history, F9 settings, F10 cash dialog. Modal/modified/repeated key events do not trigger register commands; browser F5/F11/F12 remain unchanged. These are SirfBazar commands, not an asserted vendor iPOS shortcut map.

## Rollout boundary

Deploy the matching POS API before the dashboard. `/pos/capabilities` version 2 gates the counter; an old or unauthorized backend shows a recovery message. This implementation was not deployed and no live API server was restarted. No schema change, database push, real sale or payment occurred during verification.

This is responsive merchant **web** functionality for current Windows/Android browsers, not a native Android package. HTTPS (or localhost) and Web Locks/local storage are required. Cash completion requires connectivity. Browser/device storage deletion can erase unpaid drafts and unresolved request references; clearing storage is not a supported recovery action. Saved receipts remain on the server.

USB/Bluetooth scanners must expose keyboard input and be configured with the selected suffix. Scanning was simulated, not physically certified. Printing uses the OS/browser dialog; actual printer paper, drivers, cutting and drawer behavior need hardware acceptance tests. A keyboard-wedge scanner can type into any focused text box, so cash must be confirmed manually.

Not implemented: digital/split tenders, fiscal/tax integration, fractional scale sales, price overrides/cashier discounts, refunds/returns, customer credit ledger, purchasing, cash-drawer shift reconciliation, offline sale synchronization and native peripheral adapters. Their settings sections disclose the limitation; no false working toggle is provided. This is not full legacy iPOS feature parity. Financial audit metadata currently uses the existing AuditLog table; retain these records for receipt/replay recovery. Older sales without that metadata do not invent tender/change values.

## Verification — 2026-10-06

### Automated checks

- `apps/shop`: `rtk proxy npx tsc --noEmit --incremental false` — passed.
- `apps/api`: `rtk proxy npx tsc --noEmit --incremental false` — passed; no API build or database connection needed.
- `apps/shop`: `rtk proxy npx vite build --configLoader native` — passed (production bundle).
- `apps/shop`: `rtk proxy node --test --test-isolation=none test/ipos.test.mjs test/order-alerts.test.mjs` — **10 passed** (6 new POS, 4 existing alert regressions).
- `apps/api`: `rtk proxy node -r ts-node/register/transpile-only --test --test-isolation=none test/pos-counter.test.cjs` — **7 passed**. Includes tenant/cashier isolation, duplicate references, concurrent-retry replay, preflight race recovery, stock/price/approval restrictions and financial-audit rollback.
- Targeted `git diff --check` — passed, with Windows line-ending warnings only.

Normal Vite config bundling/dev optimization hit this environment's esbuild parent-directory access restriction; the native config-loader build plus preview worked. Ordinary Node test worker spawning was sandbox-blocked; non-isolated test execution worked. The API's normal incremental typecheck could not write its cache in the sandbox; non-incremental checking passed. Test scripts `test:ipos` (shop) and `test:pos` (API) are provided for normal environments. API tests use a transactional mock, not a real PostgreSQL concurrency test.

### Browser checks

Built dashboard served through `vite preview --configLoader native --host 127.0.0.1 --port 5178 --strictPort`. Playwright CLI used `apps/shop/test/ipos-browser-fixture.js`; **every `/api/**` request was intercepted** across origins. Fake staff had POS permission only, avoiding order-alert socket connections. Test products and sales are not business records.

Passed: leading-zero barcode + repeated scan; F6 hold/F10 payment; held-bill recall; insufficient cash; saved receipt/tender/change; all seven settings groups; save/unsaved-change guard; Tab suffix/input test; preference and bill survival after reload; aborted POST response followed by same-reference retry (two test sales remained two); duplicate-tab read-only protection; no-results recovery; permission failure/retry; visible catalogue loading; native modal Tab cycling/Escape focus restoration; print media hiding dashboard and non-receipt controls.

One initial focus assertion was too strict: a native one-button dialog permits Tab to browser chrome (document active element becomes BODY), then back to its close control. Follow-up confirmed the dialog remained modal, background controls were not focused, and Escape returned to Commands. Console errors were the two deliberately injected failures (aborted sale response and 403 permission), not application exceptions.

Layout: empty and populated register at 320 px; 720 px reflow; desktop at 1440 px. No document horizontal overflow in checked states. Dark rendering was tested by applying tokens generated by the existing `deriveTheme` implementation; the existing production Theme Studio remains review-only, so this is not a claim that a production appearance switch was added. Receipt print-media rendering was inspected, not a physical print.

### Consolidated interface review

Scope: the complete new iPOS register/held/settings/cash/recovery/receipt flow, React + existing operations tokens/native controls and shared Modal. Conventions read: root AGENTS, architecture, backend conventions, API contract, deployment, remaining-work and product-capabilities documents. Other merchant screens and native apps are outside this review.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Accessible names, native form controls, visible keyboard focus, modal/Escape behavior, explicit destructive confirmations and error recovery | Clear within tested browser flow; screen reader/physical Android not verified |
| Layout | Register, settings groups, populated/empty bill, loading, no results, permission and uncertain-sale recovery; 320/720/1440 px | Clear in checked states; native 200% browser zoom not verified (720 px reflow checked separately) |
| Writing | Cash confirmation, local-only preferences, unknown-outcome recovery, hardware/fiscal status and non-vendor shortcut disclosure | Clear; unsupported functionality is named explicitly |
| Typography | Existing font, wrapping product names/help text, tabular monetary values and 16px narrow-width inputs | Clear in inspected screenshots |
| Colors | Computed heading/body/helper/action/selected-tab pairs in light and derived dark palettes | Sampled minimum 4.55:1 light and 4.65:1 dark; state also uses labels/icons |
| UI polish | Existing radii/surfaces, responsive grouping, consistent icon/control alignment and static transitions | Clear in inspected states; no animation added |

No actionable interface findings remain in the inspected flow. The interface skills influenced keyboard safety, narrow-screen reflow, explicit capability wording and recovery states. **Verdict: Approve for the stated interface coverage, not production/hardware certification.**

Evidence: `output/playwright/ipos-desktop-bill.png`, `ipos-desktop-dark.png`, `ipos-settings.png`, `ipos-mobile-bill.png`, `ipos-mobile-dark.png`, `ipos-receipt-print.png`. Before real trading: test the deployed API against a disposable database, the actual Windows/Android browsers, scanner models, receipt printers, tax requirements and cashier access lifecycle.
