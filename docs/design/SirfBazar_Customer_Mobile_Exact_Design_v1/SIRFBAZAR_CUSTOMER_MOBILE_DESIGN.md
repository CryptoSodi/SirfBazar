# SirfBazar customer mobile: design and interaction specification

**Version:** 1.0 · **Prepared:** 6 October 2026.  
**App:** existing `CryptoSodi/SirfBazar/apps/customer-app`.  
**Backend:** existing `apps/api`, not GroceryServer.  
**Runtime target:** React Native + Expo + React Navigation + TypeScript.  
**Configured API:** `https://api.sirfbazar.com/api`.

This is a newly composed **native customer-app design reference**, not the mobile website presented as a finished app. It carries forward the approved SirfBazar identity and guest-first commerce requirements. The offline HTML has 42 named screen/state compositions and both themes. It is not evidence that a native build or a live API workflow has passed.

## 1. Design goal

A customer should be able to answer: What can I buy? Which shop will fulfil it? What will it cost? Where is it going? What happens next?

The default opening screen contains a location summary, a large search field, a compact brand message, four category shortcuts and immediately usable product cards. No splash-duration requirement, marketing carousel, permissions wall or login overlay precedes shopping.

The proposed native navigation is **Home · Basket · Orders · Account**, corresponding to the existing app's HomeTab, CartTab, OrdersTab and ProfileTab. Search, categories, shops and product details belong to browsing stacks; checkout and its identity sheets use a focused flow with a persistent primary-action dock instead of competing tabs. Forty-two compositions do not require forty-two route files. [N2]

## 2. Source and authority

The user's API startup log establishes registered paths. `evidence/website-baseline-API_CONTRACT_MAP.md` retains the earlier detailed customer backend review. This turn additionally inspected the actual customer-app package, navigation, API client, checkout and LoginSheet, and the guest controller/cart merge implementation. Exact blob hashes and the limits of each inspection are recorded in `SOURCE_MANIFEST.json`.

Separate four levels: **intended design**, **source-supported API behavior**, **native implementation**, and **verified live behavior**. This package contains the first two plus browser reference tests; it does not contain a connected native app. Source on a branch is not proof of the deployed commit. Older website configurations such as NEXT_PUBLIC_API_URL and merchant VITE_API_URL are not native customer configuration.

Repository architecture and genuine installed dependencies remain authoritative. Preserve existing working functionality and uncommitted changes. Any mismatch between intended UX and current backend contract must be recorded, not concealed by sending dummy fields or substituting an admin endpoint.

## 3. Exact visual system

### Identity and assets

Use the supplied original basket and full SirfBazar wordmark; use its matching dark treatment without changing geometry. Never replace the mark with a leaf, shopfront, generic basket or monogram. The Urdu slogan remains one horizontal RTL unit:

**بازار وہی۔ طریقہ نیا۔**

The 18 SVG/PNG visual assets were verified against prior delivered SirfBazar packages. Product illustrations are fictional design content; production uses the correct returned catalogue images. They do not authorize renaming actual SKUs or claiming real product packaging. The 48 interface icon fragments have an optional native SVG adapter.

### Layout and typography

Use `reference/customer-design.css` as the specific visual source, including its last overrides. `native-handoff/LAYOUT_MEASUREMENTS.json` records computed geometry. Important baseline values: 390 × 844 logical viewport, 20 side padding (16 at compact widths), 58 app header, 72 tab-content height, 18 standard-card radius, 17 product-card radius, 20 hero radius, 13 button radius, 27 sheet top radius, 52 minimum primary-button height and 44 main icon-button dimensions. Native safe areas are added exactly once.

The 26-high simulated status bar, review rails, screenshot clock and browser inspector do not belong in the actual app. Keep the native screen flexible and scrollable; a 780 × 1688 PNG is a 2× capture, not a 780-dp design. Long text and the keyboard must never hide the primary action.

The declared font stack is Plus Jakarta Sans, Inter, Arial, sans-serif. This reference does not bundle or download fonts. The current Chromium capture reported **Inter / Inter-Bold** on the hero heading. Native intended font loading and browser reference fallback are different verification conditions; record and align them rather than silently selecting a new font. No font files are supplied.

### Light / Dark / System

| Role | Light | Dark |
|---|---|---|
| Identity | #009966 | #009966 |
| Primary action, white label | #007A52 | #007A52 |
| Canvas | #F7F8F5 | #101614 |
| Card | #FFFFFF | #19221E |
| Secondary surface | #F0F4F0 | #233027 |
| Main text | #071F18 | #F0F6F1 |
| Secondary text | #52695D | #B0C2B7 |
| Accent/link | #007A52 | #73DEAD |
| Supporting mint | #E2F6EB | #183F2C |

Use the complete palette file, not just the table. Fields, notices, tabs, sheets, icons, status/amount labels, loading/error states and system-safe-area fills change together. Product-image stages deliberately remain pale so existing packaging is recognizable. Do not invert product images.

System follows the OS only when selected. Changing appearance must retain the basket, account state, selected delivery, note/address draft, code entry, navigation stack, scroll and pending request. Persist only an explicitly validated preference through the existing theme service. A UI theme is never an authentication store.

## 4. Discovery: browse first

### Home and categories (C01–C03)

C01 starts with **Choose your delivery area**, not a fabricated detected location. Public catalogue results can be shown without an exact location; proximity, delivery coverage and estimates must be qualified until the relevant coordinates are confirmed. C02 demonstrates an explicitly selected fictional area. Replace it with actual selected/confirmed data in production.

Keep the home hero compact enough for the first two full product cards and Add actions to appear in the 390 × 844 reference. Category shortcuts are Dairy, Fresh, Bakery and Pantry in the fixture; production is driven by returned taxonomy, not a hardcoded restriction to these four. The complete category screen can show the available tree. Do not use platform-admin taxonomy writes from this customer flow.

### Search and shops (C04–C06)

Search shows actual offer results with their seller. The filter sheet uses only supported queries; use the real server's pagination/response shape. Do not turn global catalog browsing into fake priced results. Filters and scrolling survive returning from a product.

Shop cards retain shop name, business type, current returned state and actual estimate when available. Merchant cards in the reviewed API do not carry a delivery-fee value: use **Fee in basket**, not a guessed fee. No promotional counts, zero-fee claims or guaranteed minutes. Shop detail is a browsing view, not a merchant dashboard.

### Product and seller selection (C07–C08)

A product detail is retrieved by global `productId`. The customer's chosen offer has a distinct `merchantProductId`. The chosen seller, pack unit, stock and price remain next to Add. Do not silently switch the seller of an existing basket line after a cheaper offer is found.

C08 is the global catalogue variant: no invented price or Add button when no merchant listing is returned. **Check availability** opens the product/offer step. The reference has one demonstration offer per item; native implementation must render the actual number of returned offers in this same card system.

Restricted/prescription attributes are outside the approved grocery-only flow. Respect existing restrictions, and do not make those items purchasable solely because a card renderer can display them.

## 5. Basket: no account required (C09–C10)

Add does not open sign-in. Use the actual guest session/header and backend cart rather than a hidden client-only cart that vanishes at checkout. The badge is item quantity, not number of distinct lines.

The basket groups items by merchant and shows who prepares and delivers each group. The same global product from different merchant listings remains distinguishable. Quantity controls use the right cart-item ID and supported replacement-total semantics; Add uses incremental quantity. Mutation feedback must reconcile with the server.

Show item subtotals, each shop's delivery charge, overall service/small-order fees, discount/coupon feedback where present and final total. Unknown charges or failed reads are not zero. Example fees in `quote()` are review fixtures, not production pricing code.

A second shop does not clear the first shop. Explain separate deliveries. Any merchant minimum/stock/serviceability problem is visible on the affected group. Do not invent split-payment or per-rider cash instructions until the shared-fee and discount allocation is verified.

The footer becomes a focused **Continue to checkout** dock on a nonempty basket. Removing the last item produces a genuine empty-basket screen; it must never reseed sample products.

## 6. Delivery details and location (C11–C13)

Let the guest write full address and city before signing in. Contact name and delivery instructions are visible; the address editor includes a delivery contact number. These are a **frontend draft**, not anonymous writes to `/customer/addresses`.

After authentication, map draft names to the actual Address DTO (`contactName`, `contactPhone`, etc.), obtain a saved `deliveryAddressId`, and preserve explicitly selected saved addresses. Do not continuously override a newly chosen address with the server's default.

Location access is an optional user-initiated shortcut. Show the designed explanatory sheet, then the genuine native OS permission. The map picker must use actual coordinates/current configured maps or an honest fallback; the local illustration is not a geocoder. Manual browsing survives permission denial. Do not transform an area name into invented coordinates.

The existing API's location fallback and the current app's fixed Lahore fallback must not be represented as the customer's actual location. Correct that provenance in native implementation while preserving the ability to browse. Do not request background customer tracking; this is not a rider app.

## 7. Authentication, merge and final review (C14–C17, C42)

### Exact sequence

```text
Guest basket and delivery draft
→ deliberate Continue to sign in
→ phone OTP or genuine native Google credential
→ confirmed customer session
→ merge guest basket with the account basket
→ save/confirm address and refetch priced cart with coordinates
→ show changed items, quantities, fees and stock
→ final review
→ separate Place order action
```

Returning authenticated customers skip identity entry but still get the current quote/review. A user deliberately opening private Orders/Addresses/Notifications may authenticate earlier; this is not a blanket home-screen gate.

The sign-in sheet serves new and returning customers. No separate password-registration wizard or merchant CNIC fields. Google does not ask for a second local password. Login OTP has the provider's verified length and resend rules, not the rider delivery-code contract. The local six-digit demo is not a live verification mechanism.

Identity success is **not** proof that merge succeeded. The current native `afterLogin` catches all merge errors. Replace that silent outcome with explicit progress/error/reconciliation handling in the native task. Preserve guest token/snapshot until the outcome is established. The backend merge is additive and can partly apply; don't replay it automatically after an uncertain error. [N3, B2]

C16 shows the return to review; C42 preserves context when the merge is not confirmed. C42's local button documents the recovery entry, not a claimed server reconciliation endpoint. Do not declare exact-once basket recovery solved entirely in frontend code.

Final review gives a readable address, payment method, item/fee summary and **Place order · Rs …**. Terms and account policies need the actual approved content, not made-up legal text. The user must be able to change the basket/address without restarting authentication.

## 8. Order placement and payment (C18, C38–C40)

`POST /orders` reads the authenticated server cart and accepts deliveryAddressId, paymentMethod and the supported optional note/coupon. Never send client-generated orders/totals or assume a supplied amount is authoritative.

COD confirmation says **Order sent; waiting for the shop**, not accepted, paid or dispatched. Preserve the parent's identifier for multi-shop checkout and the child delivery identifiers for tracking. Once the order is confirmed, refetch the actual active cart and orders. A failed or timed-out request can follow a saved transaction; do not automatically place a duplicate.

The normal reference shows COD, and online payment is unavailable until a real supported provider flow is verified. The inspected native checkout **automatically initiates and confirms** payment when an order is PAYMENT_PENDING. That development shortcut is explicitly excluded from normal live implementation. Existing enum values and confirm endpoints are not evidence of real money being received. [N4]

A verified existing provider implementation should be preserved and styled; don't remove genuine working payment support merely because the older snapshot is mock-based. Document current deployment/source differences. Do not enter card numbers into native fields invented by this design or turn a mock confirm into a checkout button.

C39 treats uncertain placement separately from failure. C40 displays pending/unconfirmed payment without claiming charged/refunded. No financial effects occur in the HTML.

## 9. Tracking and post-order work (C19–C22, C29–C31)

Use the customer-owned detail and tracking APIs. A parent response has separate deliveries; each child keeps its own merchant, rider, timeline and state. Do not let the parent status imply all deliveries are at the same stage.

The tracking layout puts state and fulfilling shop first, followed by destination, authorized rider contact and status progression. The default reference deliberately uses an honest map-unavailable address summary. A configured native map may occupy this same region using valid returned rider coordinates and last-updated time. Never animate fake positions or label stale data live.

The customer's delivery code is only displayed when the authorized response reveals it in the eligible state; fixture screenshots mask it. Login code and delivery code are separate. Never log or upload real delivery codes to Stitch or screenshots.

Orders list uses verified range/cap semantics; no invented lifetime statistics. Cancellation only appears in allowed states and still checks the server. After merchant acceptance, expose help rather than pretending cancellation always works. Ratings/replacements use actual permission and item identifiers. Replacement suggestion is not accepted until the customer's saved decision. Refetch any changed bill/stock state.

The preview demonstrates selected timeline/order/rating variants; it does not persist full support tickets, actual cancellation or replacement financial side effects. In native implementation, wire the real service or state the specific unsupported action, never keep a decorative success toast.

## 10. Account, addresses and help (C23–C28, C41)

Guest Account offers optional sign-in without blocking public browsing. Member Account shows authorized customer identity, orders, saved addresses, appearance and help. No “member earnings,” invented loyalty benefits or subscription signup are added.

Addresses use the existing customer endpoints. Edit/default/remove operations need appropriate server-confirmed behavior; removing a saved address must not silently change a placed order. The deletion dialog is a policy checkpoint, not permission to promise all transaction records are deleted. Actual account-deletion rules must be inspected before exposing a destructive confirmation.

Notifications are personal records, not fictitious activity. Help prioritizes order-specific support, then account/app issues. A support request is not a customer-to-rider chat product; telephone uses a deliberate native dialer handoff with an authorized number. No guaranteed response time or 24/7 support claim is made.

## 11. State design and motion

Loading, successful empty, failed read, stale read, no service, no results, expired session, changed price/stock, uncertain merge and uncertain order are distinct. Never replace an error with a sample storefront. Preserve input on failed requests. Unknown statuses are displayed neutrally without guessed actions.

Use 140 ms feedback, approximately 200 ms content/sheet entrance, small movement only. Reduced motion removes the nonessential movement/shimmer without hiding feedback. Native screen transitions should remain compatible with the installed navigation stack. No fake counters, moving map pins, bounced logo, forced delay or auto-submitted checkout to finish an animation.

Use meaningful native labels/roles, keyboard-safe sheets, touch padding and accessible focus. Small visual glyphs may have larger transparent touch targets; never scale the whole screen to pass a screenshot. Sheet dismissal and Android back do not erase a basket or mutate an order.

## 12. Native reproduction and evidence

Follow `EXACT_CUSTOMER_IMPLEMENTATION.md`, full Codex prompt and `VISUAL_ACCEPTANCE.md`. Compare the actual native app with the same reference scene, theme, logical size and fixture content. Original PNGs are viewports, not full scroll documents; test below-fold details too.

The delivery includes 84 screen PNGs (42 light and 42 dark), an immutable reference manifest, layout measurements, icon adapter and replay tools. They help reproduce the target; they do not certify the native code. Production uses real API data, while isolated tests can use fictional fixtures for comparable screenshots.

Release verification must include native Google, OTP, push, selected-address quote, failed/partial merge, uncertain order, customer-to-merchant-to-rider return updates, OS text scaling, keyboard, app background/relaunch and permission denial. Only results actually obtained should be marked passed.

## Source references

Read [SOURCES.md](SOURCES.md) and `SOURCE_MANIFEST.json` for N/B/E/W identifiers, actual file hashes, inspected ranges and evidence boundaries. Design decisions are identified as such; no runtime deployment test is implied.
