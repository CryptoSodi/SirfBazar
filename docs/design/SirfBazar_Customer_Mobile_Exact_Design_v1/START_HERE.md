# SirfBazar customer mobile: start here

**Prepared:** 6 October 2026. **Design:** customer mobile v1. **Delivery:** native-app design and exact Codex handoff, not a native application or production deployment.

## Your destination

Use the **existing `apps/customer-app`** (React Native / Expo / TypeScript), backed by the **existing `apps/api`** (NestJS / Prisma). Do not edit the completed rider app, merchant dashboard, customer website, platform admin or POS. Preserve separate checkouts when that is the owner's actual setup.

```dotenv
EXPO_PUBLIC_API_URL=https://api.sirfbazar.com/api
```

The default app experience is **Home → choose products → Basket → delivery draft → OTP/Google → merge and revalidate → final review → explicit Place order**. No account gate on browsing, location selection, Add or Basket. An intentional private-account action may request sign-in.

## Open the design

Open `reference/SirfBazar_Customer_Mobile.html` in a browser. It is self-contained and performs no network calls. On desktop, use the left screen list and right theme controls. On a phone browser, the bottom DEMO selector is a design-review tool. Scroll inside the phone. Use **Fill fictional checkout details** for the local checkout demonstration.

All example shops, packages, prices, fees, addresses, identity state and orders are fictional. Verification and order creation in this preview are local demonstrations. Never copy them as production authentication or pricing.

## Give Codex the whole folder

Keep `reference/`, `native-handoff/`, `tools/`, `evidence/`, screenshots and the Markdown files together. A Markdown file without the HTML/assets is not enough to reproduce the design exactly.

Open Codex in the **actual existing project root**, then give it `CODEX_CUSTOMER_EXACT_PROMPT.md`. `COMMANDS.md` contains safe extraction, prompt and local verification commands. The full prompt authorizes implementation inside the customer frontend when the owner submits it; reading this package alone does not execute anything.

### Required reading order for Codex

1. Repository instructions and working-tree status.
2. `CODEX_CUSTOMER_EXACT_PROMPT.md` and `EXACT_CUSTOMER_IMPLEMENTATION.md`.
3. `SIRFBAZAR_CUSTOMER_MOBILE_DESIGN.md` and `SCREEN_PARITY_MATRIX.md`.
4. The actual HTML, CSS, preview interactions, original assets and all relevant screenshots.
5. `API_CONTRACT_MAP.md`, `RELEASE_GAPS.md` and `SOURCE_MANIFEST.json`.
6. `VISUAL_ACCEPTANCE.md`, measurements and QA scope.

## Work stages

| Stage | Deliverable |
|---|---|
| 0. Inspect | Find existing customer app, API/session/navigation/theming and current contracts. No competing scaffold. |
| 1. Match native shell | Exact brand, tokens, four tabs, safe areas, shared cards/inputs/sheets, complete themes. |
| 2. Shopping | Public discovery, product/shop pages, global catalogue distinction and real guest basket. |
| 3. Checkout | Address draft, late authentication, safe merge/repricing and explicit final review. |
| 4. Orders | Placement, confirmation, per-shop tracking, history, replacements and relevant support. |
| 5. Complete and verify | Account/addresses/appearance, recovery states, native screenshots, source/API checks and documented gaps. |

The requested task covers **all six stages**, not only a polished Home. A genuine contract or credential blocker should be isolated while independent work continues. Do not silently drop functionality to make a checklist green.

## Non-negotiable boundaries

The HTML is a visual specification, not a WebView to ship. Current API code takes priority for request semantics; this source-defined design takes priority for the app-controlled appearance. Actual OS chrome, permission prompts, keyboards and map content are narrow documented native adaptations.

No production payment confirmation shortcuts, fake Google credentials, local account flags, silent guest-merge failure, simulated GPS, invented APIs or automatic demo-data fallback. The implementation must not retain the old customer screen's automatic development payment-confirm call.

No backend edits, production migrations/seeding, publishing or real customer transactions are authorized by this handoff. Live test mutations require approved records and scope. Record source/deployment differences and verification gaps rather than claiming production readiness.
