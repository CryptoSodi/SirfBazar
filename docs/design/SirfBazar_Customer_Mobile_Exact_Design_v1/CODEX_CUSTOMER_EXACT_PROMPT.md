# Codex: exact customer mobile implementation

Paste this complete instruction into Codex in the actual existing SirfBazar workspace, with the entire design pack accessible. This is a native frontend implementation task, not a task to recreate an HTML demo.

---

Implement the EXACT supplied SirfBazar CUSTOMER MOBILE design in my existing native customer app. Follow all stages below, not only the Home screen. This is an implementation request: inspect, make changes, render, compare, correct and verify. Do not stop after proposing a plan.

## 1. Read the reference and existing project

Locate `SirfBazar_Customer_Mobile_Exact_Design_v1` (normally under docs/design). Read the repository instructions and preserve existing/uncommitted changes. Read START_HERE.md, EXACT_CUSTOMER_IMPLEMENTATION.md, SIRFBAZAR_CUSTOMER_MOBILE_DESIGN.md, API_CONTRACT_MAP.md, RELEASE_GAPS.md, SCREEN_PARITY_MATRIX.md and VISUAL_ACCEPTANCE.md.

Open the actual immutable source:
- reference/SirfBazar_Customer_Mobile.html
- reference/customer-design.css and customer-preview.js
- reference/assets and all screenshot states
- native-handoff/theme-tokens.ts, LAYOUT_MEASUREMENTS.json and CustomerReferenceIcon.tsx

Run tools/verify_reference.py to validate the reference lock. Do not regenerate original screenshots or alter the locked reference to make a comparison pass.

Find and reuse the existing `apps/customer-app` workspace. Inspect package/lockfile, App.tsx, current React Navigation, theme, native Google/push/location setup, API/session client, LoginSheet, checkout, basket and address/map screens. The inspected application already uses React Native, Expo, TypeScript, React Navigation, react-native-maps, react-native-svg and safe-area support. Preserve actual installed versions; do not scaffold a competing project, migrate SDK/router, install website tooling or rewrite authentication.

Do not modify the completed rider app, merchant dashboard, customer website, platform admin or POS. Backend source is existing `apps/api`. Keep separate repositories/checkouts separate if that is my actual workspace; communicate through HTTP. Do not recreate GroceryServer or import Prisma/server secrets into the mobile app.

## 2. Reproduce the selected appearance, not a similar design

The supplied customer-mobile HTML is the chosen visual source. Match its composition, card order, spacing, typography hierarchy, line heights, asset/icon shapes, stroke widths, colors, radii, fields, tab states, action docks, sheets and subtle motion. Do not substitute default UI-kit styling or generate a different interpretation in Stitch.

Use real native View/Text/Image/Pressable/FlatList/ScrollView/TextInput/Modal components. Do not ship a WebView/iframe, place screenshots over controls, copy DOM/innerHTML code or use the preview's fake identity/cart/order store as production state.

Reference width is390 logical units, height844, screenshots at 2×. A780 × 1688 PNG is not a780dp screen. Respect actual system safe areas; omit fake 9:41 clock and browser review shell. Do not absolutely position the entire interface or disable accessibility to match a still image. Exact CSS and computed measurements override approximate prose. Account for intended compact-width overrides.

Keep the approved original basket+SirfBazar wordmark. Exact slogan, one horizontal RTL unit:
بازار وہی۔ طریقہ نیا۔

Preserve the declared Plus Jakarta Sans/Inter/Arial font intent. The reference capture observed Inter, not verified loaded Plus Jakarta Sans. Match/reconcile font conditions during comparison and document genuine native differences; do not stretch text, silently change fonts or claim pixel identity across different fonts. No font binaries are included.

Use exact SVG icons with the supplied adapter or equivalent native paths. Product illustrations are fictional visual-test content; normal app cards use the correct API image and returned seller/price. Do not turn design fixtures into a production catalogue.

## 3. Implement every selected screen/state

Use Home · Basket · Orders · Account as the four visible tabs, mapping existing HomeTab/CartTab/OrdersTab/ProfileTab instead of replacing the entire router. Product, shop, search and category navigation retain back/scroll state. Checkout/detail flows use the designed action dock instead of competing tabs.

Cover all 42 compositions in SCREEN_PARITY_MATRIX.md, using reusable routes and derived states rather than42 disconnected screen files:
- Home without a location and with a confirmed selected area; categories; search/filter; shops; shop detail; product/seller offers; unpriced global catalogue.
- Single- and multi-shop baskets; guest checkout delivery draft; location explanation; actual map-picker/fallback.
- OTP/Google sign-in sheet, code step, merge review/error, final review and order-sent receipt.
- Single/multi-delivery tracking, order detail, order list.
- Guest/member account, address list/editor, appearance, help, support request, replacement decision, rating, notifications.
- Empty basket, no service, no results, loading, API error, changed stock/price, expired session, uncertain placement and unconfirmed payment.

Include below-fold content and all relevant sheet states. Keep existing working destinations. Some secondary preview actions are explanatory acknowledgements; in native code connect actual supported operations in the same component system and document genuine gaps rather than presenting a decorative toast as backend success.

## 4. Preserve guest-first checkout exactly

Do not request login on app launch, location choice, first Add, opening Basket or browsing shops/products. No mandatory intro carousel. Public shopping must remain usable after a previous private session expires.

Primary journey:
Browse → Add products → Basket → delivery draft → deliberate Continue to sign in → phone OTP or Google → confirmed customer session → merge/revalidate basket and address-aware charges → final review → separate explicit Place order.

Already signed-in customers skip identity entry but still review current charges. Intentional private-account actions such as Orders/Addresses may authenticate without a basket; this exception must not become a browsing gate.

Use one entry for new/returning customers. Do not add password, CNIC, merchant shop registration or an unsupported email-OTP flow. Native Google success must use a genuine idToken. Cancellation/errors/dismissal keep basket, address and navigation intact. OTP length and resend behavior come from the actual provider/service, not the local six-digit example.

Draft address fields before sign-in are local UI state. Save via authenticated customer-address endpoints only afterwards, mapping contactName/contactPhone correctly. Preserve explicit saved-address selection and use its coordinates, not a stale browsing location, for final repricing.

## 5. Connect the existing live APIs

Use native configuration:
EXPO_PUBLIC_API_URL=https://api.sirfbazar.com/api

Relative request paths begin /products, /merchants, /guest, /cart, /customer, /orders, /auth, /support, /notifications as appropriate. Keep /api exactly once. Do not use NEXT_PUBLIC_API_URL, VITE_API_URL, the old MySQL/Fastify routes or a new backend.

Inspect current controllers, DTOs, services/guards or verified exposed contracts before each binding. Keep the actual response envelope, string IDs, integer paisa, query limits and permissions. Source maps are not proof of deployment parity. Record exact contracts in api-status.md.

Public catalogue has no seller price or merchantProductId in the inspected baseline: show Check availability, then select a real offer. Add uses merchantProductId and incremental quantity. Update uses cartItemId and replacement quantity. Do not substitute productId for either. Multi-shop baskets stay grouped; don't clear the first shop when adding another. Use server fees and merchant minimums, not sample quote() constants.

Create and validate a guest session lazily, with a single in-flight creation where applicable. Guest cart uses x-guest-session; customer cart uses customer authority; merge uses both. Do not use the app's fixed Lahore fallback as detected user location. Keep unknown/manual/confirmed location provenance distinct. Request only genuine relevant permissions, never background customer tracking.

## 6. Correct known checkout hazards without replacing the backend

The inspected native afterLogin helper ignores every merge failure. Replace that with explicit pending/success/uncertain/error handling. Preserve guest token/snapshot until reconciliation. The source merge is additive and not proven transactional/idempotent; do not blindly retry or parallelize it after an uncertain result. Do not pretend frontend state guarantees exactly-once recovery; report required server improvements separately.

Mutation and merge responses may lack location-aware charges. Re-read cart with the selected address coordinates before final review. Show changed prices, quantities, coupons and stock. Use real integer paisa, not whole-rupee rounding that loses minor amounts or null-as-zero on failure.

The existing native CheckoutScreen calls payment initiate then confirm automatically for PAYMENT_PENDING. REMOVE that development shortcut from normal customer operation. Use genuine verified provider handling when already supported; otherwise keep online payment unavailable as designed. Never confirm payment from a local animation or a mock token. No invented card-data forms or automatic second charge.

Place order sends only the verified deliveryAddressId/paymentMethod/optional note/coupon, not client-created lines/totals. Login success does not place it. Await the actual result, preserve parent/child IDs and refetch. A timeout may follow a committed order; don't replay blindly. C39 must reconcile before another order attempt. Do not promise a locked quote or exact shared-fee COD collection until source contracts establish them.

Customer order tracking reads only the account's own order/deliveries. Never call merchant/rider progress writes. Show child-specific status, last-known location freshness and customer-only delivery code only when returned for the eligible state. Never place real codes, addresses or tokens in screenshots/Stitch/logs. No simulated moving map marker, countdown ETA or claimed dispatch from a timer.

## 7. Full Light / Dark / System and native behavior

Use the complete reference palette, including #009966 identity, #007A52 actions, #F7F8F5 light canvas and #101614 dark canvas. Apply to all components, safe areas, forms, notices, sheets, loading/error states and navigation. Product images retain accurate colors. System follows device changes only while selected.

Reuse current theme infrastructure. Theme switches must not remount navigation or lose cart/draft/code/payment selection/order/context. Persist only the validated preference with safe storage fallback. Keep140 ms feedback and200 ms small entrances; honor reduced motion, no fake progress or forced delays.

Use actual native keyboards, accessible labels, roles, expanded touch areas, Android back and scrollable keyboard-safe sheets. Preserve at least the reference control sizes while supporting larger text. Native OS prompts and maps are narrow documented differences, not permission to redesign the app. Use the existing development build for native dependencies; do not run destructive prebuild-clean or upgrade the whole SDK.

## 8. Test the actual implementation and repair differences

Use isolated local visual/component fixtures with the exact reference content. They must not enter ordinary production screens or provide a public login bypass. Real application requests must never fall back to sample data on error.

Capture actual Android/iOS UI using available device tooling at matched logical sizes, theme, font, content, scroll and settled animation. Compare against reference/screens with side-by-side/overlay/diffs; repair geometry, wrapping, colors, glyphs, CTA position and sheet sizing, then repeat. All 42 states need both-theme coverage, plus System behavior; verify320 / 360 / 390 / 412 widths as relevant supported devices and large text. Separate OS-owned regions through narrow documented crops, not broad masks. Do not overwrite expected images, stretch mismatches or widen thresholds to claim exactness.

Run actual package typecheck, available native builds/component tests and safe integration checks. Reference HTML tests are not native tests. Check stock/price changes, guest expiry, auth cancellation, merge failure/partial outcomes, payment unavailable, empty/error distinction, uncertain order, account switching, selected-address repricing, back, keyboard, screen readers, theme persistence and relaunch.

## 9. Safety, completeness and final delivery

Implement native frontend handlers, but live API test writes require approved test identities/records and explicit scope. Do not create real customers/guest sessions/carts/orders, send OTPs/pushes/messages, cancel deliveries, confirm payments or delete accounts just to demonstrate the design. Public source/read inspection and isolated fixtures should be used first. No backend edits, seeds/migrations, production deployment or app-store release is authorized.

Preserve completed merchant/rider work. Missing credentials, native tooling or Stitch access blocks only its specific verification. Continue independent implementation; report exact blockers without fabricated results. Do not regenerate a new design in Stitch: reuse actual available references only, and never claim MCP actions that were not performed.

Maintain screen-status.md, api-status.md, visual-parity-report.md and design-deviations.md from templates. Deliver exact files changed, all screens implemented, API handlers connected, actual tests/live reads/approved test mutations performed, native Light/Dark screenshots, comparisons and remaining gaps. Never declare “100% exact”, “production ready” or “all 175 APIs integrated” based on a prompt or browser screenshot.

Start now. Implement the selected native app, not another design explanation or disconnected demo.
