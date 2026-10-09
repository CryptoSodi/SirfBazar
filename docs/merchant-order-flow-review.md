# Merchant order and SaaS-access review

Date: 2026-10-09. Branch: codex/merchant-order-flow. This records the pre-release local verification checkpoint; subsequent PR, CI and deployment records establish release status.

## Scope and coverage

Reviewed complete local web flows: merchant order sidebar and its persistent accept alert, and Admin → Merchants → Disable/Reactivate. React/TypeScript, existing native HTML dialogs, Tailwind utilities, merchant-v2 theme tokens and shared operations styles. No new visual framework.

Conventions inspected: AGENTS.md, architecture.md, backend-conventions.md, api-contract.md, remaining-work-report.md, product-capabilities-report.md and deployment.md. Interaction/policy details are in merchant-order-flow.md and merchant-saas-access.md.

This is a screen/flow review, not an independent PR audit or approval to deploy. Native screens were inspected in source and exported for Android; physical-device behavior, TalkBack and native visual layout were not verified. Admin screenshots cover its default light theme, not a rendered dark-mode audit.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Orders.tsx:276 labelled next-step section; Orders.tsx:289 native rider label/select; components/ui.tsx:29 native dialog; keyboard accept/select/assign, Escape/focus return; admin confirmation buttons and reason label | Clear within covered web flows; admin access buttons verified at least 44px high |
| Layout | Sidebar renders at 1280/640/320px, admin access modal at 1280/320px; empty, retry and uncertain-result recovery; rider controls stay in one sidebar | Clear; no horizontal overflow in checked dialogs |
| Writing | SignupFlowPage.tsx:55, Merchants.tsx:114, Profile.tsx:256; order next-step, waiting-for-packing, staff permission and disable consequences | Clear; explicit continued access, no automatic billing/expiry, actionable recovery |
| Typography | Merchant 16px rider control; admin index.css:74 16px inputs; wrapped order identity, addresses and rider text at 320px | Clear for rendered web states; native font scaling not verified |
| Colors | Merchant index.css:7 and :11 actual light/dark token pairs; computed contrast on workflow and slate-text details in browser fixture; default-light admin screenshot | Clear in checked states; merchant minimum text ratio 5.18:1, admin dark not verified |
| UI | Existing spacing/surfaces/buttons, 12px section/8px nested-card radii, visible focus, existing reduced-motion rules, destructive disable confirmation; screenshots inspected | Clear within covered web flows |

## Findings

No remaining actionable interface findings in the covered web flows. During verification, mismatched theme aliases and fixed slate text made dark-mode workflow/customer/address details too dim; these were corrected using the existing merchant theme tokens. The browser regression now measures those details as well as the new action controls.

## Verification

Passed locally:

- API: the existing remediation unit suite plus POS counter tests, run with Node 22 and ts-node/transpile-only: **70/70 passed**. Includes 9 order-flow and 7 SaaS-policy tests, atomic rollback/competing claims in the in-memory transaction adapter, legacy readiness flow, permissions, trial calendar boundaries, access disable/reactivate, audit rollback and notification failures. These are not proof of real PostgreSQL concurrency.
- TypeScript no-emit checks: API, merchant web, admin web, merchant native and rider native passed.
- Merchant production build: Vite passed. Existing large-chunk warning remains.
- Admin production build: Vite passed with configLoader runner; the default bundled config loader encountered this Windows environment's directory-access problem.
- Local fully mocked browser runner: BROWSER_ADMIN_URL=http://127.0.0.1:5211 node scripts/browser-merchant-order-flow.mjs, merchant preview at 5210. Passed keyboard accept → Preparing → inline rider assignment → ready, busy-rider exclusion, staff permission restriction, empty/failed rider recovery, uncertain-result write lock, GET-only recovery after lost responses, and persistent-alert acceptance navigation. No live API writes or external requests were allowed.
- Admin fixture: 4 access mutations across two viewports, explicit disable confirmation, optional reason, 44px controls, lost-response reconciliation without a repeated POST and unchanged trial date.
- Native merchant sign-in/onboarding regression suite: 7 passed. Native rider session/order helpers: 4 passed.
- Expo export --platform android --no-minify: merchant and rider bundles both passed. These are JavaScript/Hermes exports, not installable APKs.
- git diff --check passed.

Not verified:

- Real database fixture: localhost:15437 was reachable but rejected documented remediation fixture credentials before writes. Newly added real PostgreSQL tests must pass in the isolated CI database (or an authorized local test database) before deployment.
- Updated APK installation, physical-device interactions, TalkBack and live push delivery.
- Live deployment and live customer journey. No production shop was created, activated or disabled by this work.

Screenshots: output/playwright/merchant-order-flow-{1280,320}-{light,dark}.png and admin-merchant-access-{1280,320}.png. Generated artifacts are local and are not required source files for deployment.

## Verdict

Approve for the covered local web interface flows: no HIGH interface findings remain. This is not production release sign-off; database verification and physical native testing remain outstanding.

## Rollout boundary

New shops start active/online/open, with one calendar month of informational trial and continued access unless explicitly disabled by admin. Trading hours, approved listings/stock and destination eligibility still apply. Existing submitted shops require explicit Admin → Merchants → Activate shop; there is no mass activation or trial reset. WhatsApp OTP/configuration, payment authority and database schema are preserved.

Release the backend and matching dashboards together after verification; native features require updated APKs. Existing orders are not automatically cancelled/refunded when disabling a shop, so admin must handle active fulfilment first.
