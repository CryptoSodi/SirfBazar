# Customer mobile v5 layout implementation

## Current completion pass — 6 October 2026

The original review below is historical. Native customer completion now adds secure credential migration, bounded location recovery, realtime order updates, notification inbox/deep links, support conversations, profile editing and persistent checkout recovery. Native checkout now enables COD only; earlier statements about selectable development payment methods are superseded. Stable checkout references and transactional basket/stock/payment claims prevent duplicate submissions. See [the completion and release-gate report](customer-mobile-completion.md) for current validation and device/provider limitations; successful JS exports are not signed Android/iOS builds.

Reference inspected before implementation: rendered `#customer/categories`, `shop`, `product`, `basket` (empty/populated), `checkout` (empty/populated), `tracking`, `orders`, `saved`, `account`, and `help`. Reference screenshots: `.playwright-cli/ref-customer-*.png`.

| Reference | Actual route / implementation | Interaction and states |
|---|---|---|
| Categories | Browse tab + Category route | Location-filtered API, chips, search, pagination, loading/error/empty |
| Shop | Shop | Merchant summary, own-delivery context, filters, product grid |
| Product | Product | Actual imagery, merchant offer selection, availability, guest Add |
| Basket | Cart | Multi-merchant groups, quantity/remove, coupon, server totals |
| Checkout | Checkout | Final-step login, saved addresses/editor, payment methods, order submission |
| Orders | Orders | Authentication gate, actual history, multi-merchant details |
| Tracking | OrderDetail | Polling, timeline, shop-owned rider, conditional OTP, cancellation/rating |
| Account | Profile | Guest login/profile/wallet, addresses, appearance, logout |
| Help | Help | FAQ and authenticated support-ticket API, optional order ID |
| Saved | No verified API/store | No fake records or nonfunctional control |

Layout: flat Home/Browse/Orders/Account tabs, header basket access, 20px insets (16px narrow), line icons, 14px cards, two-column product grids, merchant cards and themed state panels. Preserve the existing multi-shop API over the prototype's single-shop assumption. Do not use fictional packaging or maps that imply live GPS.

Catalogue interaction: Add becomes a quantity stepper after the server accepts the item, matching the populated reference. The stepper reads the existing cart refresh snapshot and uses the existing guest/customer quantity endpoint; zero removes the item. Pending requests disable controls and failures leave the last confirmed quantity visible.

## Implemented — 27 September 2026

Changes are in the existing `apps/customer-app`, not a replacement project. `CustomerUI.tsx` owns the shared header, icons, search, category chips, product/shop cards, state panels and fee summary; `CatalogScreen.tsx` serves Browse, Category, Search and Shop. Product offer selection retains the originating merchant. `AddButton` now becomes the confirmed cart quantity control. The existing cart refresh store supplies quantities without making a request per card.

Home now puts categories ahead of vertical neighbourhood-shop cards and a product grid. The approved logo, green branding and single-line `بازار وہی۔ طریقہ نیا۔` remain. Basket, checkout, history, tracking, account and the new help hub use the reference hierarchy. Checkout keeps real saved addresses and all existing payment handlers; tracking keeps polling, merchant-owned riders, conditional delivery OTP, cancellation and rating.

Dark mode uses the reference panel/canvas/border tokens. A direct browser media-query subscription fixes System appearance staying on its previous palette after an OS/browser preference change. Native platforms retain React Native's appearance hook. The reference's sample map, saved-product buttons, demo login, fictional orders and illustrated packaging are not shipped as real functionality.

## Scope and interface review

Scope: customer Expo web at `http://localhost:8084`, backed by `http://localhost:3001/api`; React Native, React Navigation, existing semantic StyleSheets and `react-native-svg`. No new app dependency was added. Project guidance inspected: repository `AGENTS.md`, branding/design implementation documents, v5 HTML, architecture and API contract. This is a screen/flow review, not a review of the repository's other pending changes.

| Domain | Evidence inspected | Result |
|---|---|---|
| Accessibility | Labelled headers/basket/search/actions, selected theme/payment state, keyboard Enter navigation, visible browser focus ring, persistent cart/checkout errors | Clear in sampled controls; full screen-reader/device audit not verified |
| Layout | Reference and actual category/shop/product/basket/checkout/account screenshots; 320px main-flow checks and 768px shared-layout checks | Clear; no document-level horizontal overflow in tested widths |
| Writing | Real merchant delivery wording, actual fees/statuses, guest checkout, missing imagery, error retry guidance | Clear; no fictional delivery or payment-success claims added |
| Typography | Title/body/metadata hierarchy, wrapped shop/product/address names at 320px, one-line Urdu slogan | Clear in browser screenshots; native font scaling not verified |
| Colors | Light/dark captures and body/secondary/action/accent contrast calculations | Clear for measured pairs |
| UI polish | Flat four-tab navigation, line icons, shared card radii/insets, product wells, quantity states, loading/empty/error transitions | Clear for reviewed routes; reduced-motion Add bounce removed |

Resolved findings:

| Severity | Domain | Location | Before | After | Why |
|---|---|---|---|---|---|
| HIGH (fixed) | Colors | `apps/customer-app/lib/theme.ts:181` | System selection could remain on the preceding web palette | Explicit media-query listener; verified light → dark → light | System appearance must track the actual preference |
| HIGH (fixed) | Accessibility | `apps/customer-app/screens/CartScreen.tsx:202`, `screens/CheckoutScreen.tsx:283` | Mutation/checkout failures only appeared briefly in a toast | Persistent error notice with recovery guidance and alert semantics | Errors remain available while the user corrects them |
| MEDIUM (fixed) | Layout | `apps/customer-app/components/CustomerUI.tsx:318`, `components/CatalogScreen.tsx:16` | Unrelated catalogue/detail arrangements and card sizing | Shared two-column cards, filter strip and responsive insets | Category, shop and search now use the same reference structure |
| MEDIUM (fixed) | UI polish | `apps/customer-app/components/CustomerUI.tsx:61` | Header basket navigation could reopen the retained checkout route | Explicitly target the Cart screen | Basket always opens the intended destination |

Verdict: **Approve for local design testing within this coverage**. This is not an Android/iOS release sign-off or a full accessibility audit.

## Verification

Passed:

- `rtk proxy npm run typecheck` in `apps/customer-app` (`tsc --noEmit`).
- `rtk proxy git diff --check -- apps/customer-app docs/CUSTOMER_MOBILE_V5.md docs/DESIGN_IMPLEMENTATION_STATUS.md` (only Windows LF/CRLF normalization warnings).
- Browser at 390px: Browse → category filter → product → shop → basket → checkout; search with no results; pagination; product merchant selection; Add → quantity stepper; increase/decrease/remove; empty basket; two-merchant basket; invalid coupon error and persistent recovery message.
- Live local flow: guest Add returned 201 from `http://localhost:3001/api/guest/cart/items`; development OTP login merged the basket; address creation returned to checkout; COD order submission returned 201; real tracking timeline/history displayed; order-help ticket returned 201; cancellation completed and history showed cancelled status.
- Payment radio selection and saved-address selection were checked. No external payment transaction was attempted.
- Light and dark screenshots captured for core shopping screens. Main layouts tested at 320px: home, categories, product, shop, basket, checkout, orders, account, help. Home/catalogue/checkout additionally tested at 768px. Document width equalled the viewport in every reported overflow check.
- Dark persisted across reload. System transitions returned heading colors `rgb(23,35,33)` → `rgb(237,241,244)` → `rgb(23,35,33)` after the fix.
- Keyboard Enter opened Browse and a product. Tab showed a visible focus ring on an account action. Guest account and order-login gate rendered correctly. Final fresh browser smoke reported zero console errors (existing React Native Web deprecation warnings remain). Intentional 503/invalid-coupon checks produced expected HTTP errors during fault tests.
- Browser-scoped 503 interception displayed a catalogue error; removing the interception and selecting Try again restored live products. No server configuration was changed for the fault test.
- Measured contrast ratios: light body 16.17:1; light secondary 5.10:1; dark body 14.76:1; dark secondary 8.03:1; white/solid action 5.38:1; dark accent/panel 5.87:1.

Screenshot evidence is retained locally in ignored `.playwright-cli/`: `ref-customer-*.png`, `mobile-v5-categories-{light,dark}.png`, `mobile-v5-categories-populated-light.png`, `mobile-v5-{shop,product,basket,checkout}-{light,dark}.png`, `mobile-v5-tracking-dark.png`, `mobile-v5-orders-{light,dark}.png`, `mobile-v5-account-{light,dark}.png`, `mobile-v5-help-dark.png`, and `mobile-v5-*-320-*.png`. The rendered dark reference category and checkout captures are `ref-customer-categories-dark.png` and `ref-customer-checkout-dark.png`.

Test data: a local development customer (`+923009990027`), a clearly named test address, cancelled COD order `SB20260927-BA2A30` (`cmujj05in004ki5gsvzfuc7eb`), and one order-linked support ticket marked “Local UI verification only. No action required.” Test basket items were removed after verification. No production data or production services were modified.

## Specific limitations

- Local seed products used in these tests have null image URLs. Neutral placeholders are intentional; matching the reference's product-rich appearance requires actual catalogue imagery.
- Saved items/wishlist has no verified API or existing store. No fake saved-items screen or heart control was added.
- Tracking shows actual timeline data and only exposes a rider-location link when coordinates exist; no fictional live map was added. Assigned-rider, delivered/OTP and rating branches were not exercised with a completed delivery this pass.
- Android/iOS hardware/emulators, native large-text behavior, full screen-reader traversal and browser 200% zoom were not verified. Browser checks at 320px are not presented as a substitute for those checks.
- Existing non-COD payment integrations remain the project's development/mock implementation. Support ticket creation works; ticket inbox/conversation UI remains separate work.
- Other SirfBazar applications and the broader all-app Theme Studio rollout are outside this customer-mobile correction.
