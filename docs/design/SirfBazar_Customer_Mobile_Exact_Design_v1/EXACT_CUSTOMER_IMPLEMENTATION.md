# Exact native implementation contract: customer mobile

**Prepared 6 October 2026.** The selected visual target is `reference/SirfBazar_Customer_Mobile.html`, not the merchant dashboard, rider design or customer website. This is a specification to implement in the actual native application; no native code has been deployed by providing it.

## 1. Inspect before changing

Read repository instructions; inspect git status and preserve the owner's work. Locate the active customer native checkout, previously `apps/customer-app`. Do not create another Expo scaffold because an older plan uses another folder name. Do not move code to force a repository layout.

The inspected package is React Native 0.81.4, React 19.1, Expo ~54, TypeScript ~5.9, React Navigation 7, native Google sign-in, Expo location/notifications, react-native-maps, SVG and safe-area support. **These are manifest observations, not an upgrade directive.** The current package and lockfile win if newer. Use existing development-build/native configuration and API client.

Inspect App.tsx, navigation, theme, components/LoginSheet.tsx, CheckoutScreen, CartScreen, Product/Shop screens, address/map screens, lib/api.ts, badge/push/location code, error handling and any existing tests. The startup log and maps show contracts to inspect, not permission to assume every response matches an old example.

## 2. Visual precedence

| Concern | Authority |
|---|---|
| Appearance | Actual immutable HTML/CSS/assets and screenshot states in `reference/`. |
| Intended behavior | Customer mobile design document and latest owner request. |
| Native architecture | Existing application, installed dependency versions, repository instructions. |
| API behavior | Current controller/DTO/service and verified deployment contract; then source-reviewed map. |
| Final evidence | Real native app captures/tests and separately documented integration results. |

“Exact” means faithful app-controlled composition, not drawing a fake OS clock, disguising a WebView or showing static screenshots instead of controls. It is not a reason to drop accessibility, force strings into clipping boxes or fake unavailable backend behavior.

Use original SVG/logo paths and full tokens. Convert DOM/CSS layout into native View/Text/Image/Pressable/FlatList/ScrollView/TextInput/Modal components. Do not paste raw CSS into React Native StyleSheet, use the HTML's innerHTML renderer, or carry its example state into production. Native navigation and selected-route styling must match without replacing working navigation architecture unnecessarily.

## 3. Screen and component responsibilities

Reuse current tabs **HomeTab / CartTab / OrdersTab / ProfileTab**, displayed as **Home / Basket / Orders / Account**. The design's category/search/shop/offer views extend the existing browsing stack. Checkout hides shopping tabs and uses its own action dock; editing an address returns to the same selected checkout state. Returning/back should preserve filters, scroll and basket.

Suggested components, names adapted to existing repository:

```text
CustomerAppShell / CustomerHeader / CustomerTabBar / CustomerActionDock
LocationSummary / SearchField / CategoryTile / ProductCard / QuantityStepper
ShopCard / ProductHero / SellerOfferCard
BasketMerchantGroup / CartLine / ChargesSummary / CartIssueNotice
CheckoutProgress / AddressDraft / PaymentOption / FinalOrderReview
CustomerLoginSheet / OtpInput / MergeStatus
OrderReceipt / DeliverySelector / TrackingSummary / DeliveryTimeline
CustomerAccount / AddressCard / AppearancePicker / SupportForm
CustomerDialog / InlineError / EmptyState / LoadingSkeleton
```

Forty-two named frames include states and sheets, not forty-two separate mandatory native routes. Use shared real screens and derive states from actual data/auth/capability outcomes. `SCREEN_PARITY_MATRIX.md` is the visual coverage checklist. No public “preview mode”/auth bypass to access fake member screens belongs in production.

## 4. Geometry and typography locks

Reference screenshots are **390 × 844 logical units** at scale 2, producing **780 × 1688 PNGs**. Match logical widths; never set a React Native screen to780dp. Core values:

| Element | Target |
|---|---|
| Page sides | 20; compact layout16 at ≤360 reference widths |
| Real app header | 58 high baseline, safe area separately |
| Fake review status bar | 26 in HTML; omit and let OS own it |
| Heading |28, line-height≈32.76, letter-spacing−0.9 |
| Section heading |19, line-height≈23.75 |
| Body/input |14 body with component overrides; input16 |
| Standard cards |18 radius,17 padding |
| Product cards |17 radius, exact internal CSS geometry |
| Primary buttons |min52 high,13 radius |
| Add buttons |44 high; source width/layout unchanged |
| Icon actions |44×44 main action; sheet close40 visual with expanded native hit target |
| Tabs |72 app-owned height, plus actual bottom safe area once |
| Action dock |12 top /20 sides /16 bottom, keyboard-safe |
| Sheet |27 top corners,9/22/25 padding, maxheight93% of reference region |
| Glyphs |22 default, stroke1.7; preserve per-component overrides |

Inspect `native-handoff/LAYOUT_MEASUREMENTS.json` for computed variants. It is browser geometry, not proof of native measurements. Text defaults, flex defaults and baselines differ across renderers; make them explicit in native styles. Allow body text scaling and content growth; do not hardcode vertical positions for an entire screen.

The source declares Plus Jakarta Sans, Inter, Arial, sans-serif. Local browser hero rendering was observed as Inter. No font binaries are included. Load the intended family through the actual project's licensed/dependency setup and compare under known font conditions. Record unavoidable system fallback/weight differences rather than claiming exactness from dissimilar fonts. Do not silently switch branding typography.

## 5. Images and icons

Use provided exact basket/wordmark and one-line slogan variants. `ASSET_PROVENANCE.json` verifies their inherited asset bytes. The `CustomerReferenceIcon.tsx` adapter uses the already-declared react-native-svg package; inspect installed compatibility rather than reinstalling. It is a helper source file, not a compiled native app or approval to use arbitrary remote SVG markup.

The 12 grocery product pictures are fictional illustrations for deterministic review only. Replace them with accurate API images in normal operation while preserving containment/aspect ratio and card geometry. Null/broken images get honest nonbranded placeholders, not fake stock photography identifying a different product. Do not invert product images in dark mode.

## 6. Theme behavior

Use every token from `native-handoff/theme-tokens.ts`, not ad-hoc green constants in screens. Light/Dark/System appearance must affect headers, tabs, safe areas, cards, inputs, notices, selection, sheets, shadows and focus. Native status-bar contrast follows the selected effective mode. Reuse the current app theme provider and Appearance handling where possible.

Do not remount the app/navigation on a theme switch. Retain text entry, verification progress, draft address, current basket, chosen seller, selected delivery, notes, scroll and in-flight requests. Persist validated preference with safe storage fallback. Response data and session authority must not depend on theme storage.

## 7. API integration and critical checkout work

Configure the actual customer native environment:

```dotenv
EXPO_PUBLIC_API_URL=https://api.sirfbazar.com/api
```

Use relative `/products/...`, `/guest/cart/...`, `/cart/...`, `/orders/...`, `/customer/...`, `/auth/...` paths. The same API serves existing merchants/riders, but customer code must not call their privileged write endpoints.

Before integrating, verify each method, query/body, response envelope, permission, optional field, money/date definition and paging limit. Keep string IDs; distinguish productId, merchantProductId, cartItemId, order/childOrderId. Do not invent `/api/customer/dashboard`, login-password or guest coupon-removal routes.

Default home and Add use anonymous/public/guest mechanisms. No login modal on app start or cart open. Address before login is a local UI draft; save authenticated Address DTO later. OTP and genuine native Google share one new/returning entry. Login success must not auto-place an order.

Preserve guest token/snapshot through merge. Replace ignored merge errors with explicit states. Refetch the customer quote with checkout-address coordinates before final review. Do not blindly retry additive merge after partial/uncertain failure; record the required server guarantee. A native queue cannot create transactional idempotency that the server lacks.

Remove the inspected automatic development payment initiate→confirm shortcut from normal checkout. A legitimate verified provider flow can remain, otherwise online methods are unavailable. COD still requires real server placement and then waiting-for-shop status, not paid/accepted. Do not change server payment code in this task.

Disable repeated order submissions while pending. If a timeout makes saved state unknown, reconcile through authorized order reads before retry. Do not automatically place a second order, silently change fees or promise an immutable quote. Multi-shop child totals may not equal the parent total; verify cash allocation rather than inventing who collects shared fees.

## 8. Native-only responsibilities

Use real safe areas/status bars, accessible buttons/switches, scrollable keyboard-safe sheets, correct phone/OTP keyboards, hardware back and screen-reader roles. No simulated permission alert, fake geolocation, hidden background customer tracking or `tel:` preview masquerading as a call.

Use actual native Google account chooser/return; cancellation preserves cart and draft. Expo Go is not a substitute for testing custom native modules; reuse the installed development-build workflow. Do not run a destructive clean prebuild or SDK migration solely for this design. [W2]

Maps show confirmed coordinates and current last-known rider data with freshness, or the designed unavailable-state summary. Do not build a fictional route from static SVG lines. Notifications must target the current signed-in account; unregister/clear appropriately when switching identities without dropping the user's deliberate public browsing context.

## 9. Reference exactness versus honest production exclusions

Remove only review-specific rails, scenario selector, fixed sample clock, `__customerDesign`, fixture reset/fill buttons, sample-only disclaimers and fake mutation success handlers. Product images and records become accurate live data. Real maps/OS dialogs may replace the documented placeholder region. Record all such exclusions in design-deviations.md; don't use them as excuses to restyle cards or navigation.

The reference demonstrates many actions but some secondary dialogs are explanations rather than a complete account-removal, support-list, replacement or payment engine. Complete actual supported functionality using the selected component system. Report any contract/policy gap explicitly instead of shipping those explanatory dialogs as finished customer features.

## 10. Phased implementation and acceptance

Work through the stages in START_HERE.md and maintain all screen/API statuses. Test both themes for every reference composition, System updates, supported devices and large text. Capture actual native screens at matched logical sizes/content and compare against the fixed reference with side-by-side/overlays/diffs. Correct errors and repeat. Do not replace expected screenshots or widen tolerance to make failures disappear.

Run available type checks, existing native builds/component tests and safe integration tests. Browser reference results are not native results. Missing native tooling or approved test credentials blocks only that verification; implement independently feasible work and name the blocker.

Final report includes exact files changed, implemented screens, API operations wired, actual live reads/test mutations, native screenshots, visual differences, verified scenarios and remaining blockers. No “100% exact”, “all APIs integrated” or “production ready” claim without evidence. No backend/database/deployment/store-release action is part of this task.

## Source references

Read [SOURCES.md](SOURCES.md) and `SOURCE_MANIFEST.json` for N/B/E/W identifiers, actual file hashes, inspected ranges and evidence boundaries. Design decisions are identified as such; no runtime deployment test is implied.
