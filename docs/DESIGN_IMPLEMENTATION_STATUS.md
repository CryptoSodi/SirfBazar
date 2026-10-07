# SirfBazar v5 design implementation status

Reference: [`design-reference/SirfBazar_Design_Studio_v5.html`](../design-reference/SirfBazar_Design_Studio_v5.html), SHA-256 `7f56ea3147ef296518b3f01b3265969569ca80a8c5b8012e2eaff7b26c1242a9`. The 56px Design Studio rail, fictional records, role switcher and theme exporter are review-only. The current repository has eight deployable packages: API, customer web and native, merchant web and native, rider native, admin web and POS web. This map records actual routes rather than creating prototype hash routes. “Mapped” is not implemented or tested.

| Reference route | Actual app / route and component | Data source | Scope | Status / verification / blocker |
|---|---|---|---|---|
| `#customer/home` | customer native `HomeTab`, `HomeScreen` | catalog + location API | Existing | V5 header/hero, categories-first hierarchy, vertical shop cards and product grid implemented; 320/390/768px browser checks passed. |
| `#customer/categories` | customer native `BrowseTab` / `Category`, shared `CatalogScreen` | catalog API | Existing equivalent | Implemented through shared Browse/Category catalogue; filters, search, pagination and quantity controls verified against local API. |
| `#customer/shop` | customer native `Shop`, `ShopScreen` | merchant catalog API | Existing | V5 merchant summary, own-delivery notice, search/chips/grid implemented and visually checked in light/dark. |
| `#customer/product` | customer native `Product`, `ProductScreen` | product API | Existing | V5 image/title/price/availability hierarchy, merchant offer selection, Add/quantity and shop navigation implemented and tested. |
| `#customer/basket` | customer native `CartTab`, `CartScreen` | guest/customer cart API | Existing | V5 merchant groups, item stepper, coupon/errors and server fee summary implemented; multi-shop, remove and empty states tested. |
| `#customer/checkout` | customer native `Checkout`, `CheckoutScreen` | cart/order/payment API | Existing | V5 address/payment/summary layout implemented; guest merge, saved address and local COD submission tested. |
| `#customer/tracking` | customer native `OrderDetail`, `OrderDetailScreen` | order timeline API | Existing equivalent | V5 status/timeline/shop-owned rider sections implemented; real local order and cancellation tested; delivered/rider stage unverified. |
| `#customer/orders` | customer native `OrdersTab`, `OrdersScreen` | customer orders API | Existing | V5 actual-order cards and auth gate implemented; cancelled local test order displayed. |
| `#customer/saved` | no saved-items native screen | no verified saved-items API | Backend/product decision missing | Do not add fake saved items |
| `#customer/account` | customer native `ProfileTab`, `ProfileScreen` | customer profile API | Existing equivalent | V5 guest/profile hero, menu and appearance cards implemented; light/dark/system and persistence tested. |
| `#customer/help` | `Help`, `HelpScreen` from Account/OrderDetail | support API | Implemented UI, existing backend | Help hub implemented with FAQs and real order-linked support-ticket submission (201 verified). |
| `#website/home` | customer web `/`, `app/page.tsx` | catalog + coupons API | Existing | V5 two-tier header, feature hero, real category promos and feed applied; 1440px/390px screenshots and pantry navigation verified. Fictional reference grocery props intentionally replaced with the approved basket mark. |
| `#website/categories` | customer web `/category/[id]`, `/search` | catalog API | Existing equivalent | Mapped; v5 restyle pending |
| `#website/shop` | customer web `/shop/[id]` | merchant catalog API | Existing | Mapped; v5 restyle pending |
| `#website/product` | customer web `/product/[id]` | product API | Existing | Mapped; v5 restyle pending |
| `#website/basket` | customer web `/cart` | guest/customer cart API | Existing | Mapped; v5 restyle pending |
| `#website/checkout` | customer web `/checkout` | cart/order/payment API | Existing | Mapped; v5 restyle pending |
| `#website/tracking` | customer web `/orders/[id]` | order timeline API | Existing equivalent | Mapped; v5 restyle pending |
| `#website/orders` | customer web `/orders` | customer orders API | Existing | Mapped; v5 restyle pending |
| `#website/saved` | no saved-items web route | no verified saved-items API | Backend/product decision missing | Do not add fake saved items |
| `#website/account` | customer web `/profile` | customer profile API | Existing equivalent | Mapped; v5 restyle pending |
| `#website/help` | `/faqs`, `/contact`, order support | support API + static content | Existing equivalent | Mapped; consolidated hub pending |
| `#merchant/dashboard` | merchant web `/`, `Dashboard.tsx`; native `Tabs/Home` | merchant dashboard/profile/earnings API | Existing | V5 web and Expo home hierarchy implemented. Local OTP login, real seeded merchant, online/offline and desktop/390px visuals verified. Nonzero charts unverified. |
| `#merchant/orders` | merchant web `/orders`, `Orders.tsx`; native `Tabs/Orders` | merchant orders API | Existing | V5 web order heading/filters/table/empty state implemented and compared with the reference at desktop/390px. Native order detail restyle pending. |
| `#merchant/products` | merchant web `/products`; native `Tabs/Products` | merchant products API | Existing | Mapped; v5 restyle pending |
| `#merchant/create-product` | merchant product form on `/products` | merchant products API | Existing equivalent | Mapped; v5 restyle pending |
| `#merchant/categories` | shared catalog selection in merchant product flow | catalog API | Existing equivalent | No independent merchant category admin |
| `#merchant/stock` | stock controls on `/products`; native product detail | merchant products API | Existing equivalent | Expiry workflow not verified |
| `#merchant/pos` | POS web `/` | POS API | Existing but concept extension | Preserve current POS; no fake transactions |
| `#merchant/purchases` | no route | no verified purchase API | Concept | Keep out of live navigation |
| `#merchant/suppliers` | no route | no verified supplier API | Concept | Keep out of live navigation |
| `#merchant/invoices` | POS `/sales` receipts | POS API | Existing equivalent | Marketplace invoices not verified |
| `#merchant/returns` | no dedicated merchant route | refund/order API | UI missing, backend available | Pending contract review |
| `#merchant/riders` | merchant web `/riders`; native `Tabs/Riders` | merchant-owned riders API | Existing | Mapped; ownership must remain scoped |
| `#merchant/customers` | no dedicated route | merchant orders API | Backend/product decision missing | No customer CRM assumed |
| `#merchant/coupons` | no merchant coupon route | public/admin coupons API only | Backend/product decision missing | No merchant promotion editor assumed |
| `#merchant/settlements` | merchant web `/earnings`; native `Tabs/Earnings` | earnings + settlements API | Existing equivalent | Mapped; v5 restyle pending |
| `#merchant/reports` | `/earnings` by-day report | earnings API (FINANCE permission) | Existing equivalent | Mapped; no invented measures |
| `#merchant/team` | no UI | merchant staff API | UI missing, backend available | Permission UI pending |
| `#merchant/support` | no merchant hub | support API | UI missing, backend available | Pending |
| `#merchant/settings` | merchant web `/profile`; native `Tabs/Profile` | merchant profile API | Existing | Mapped; v5 restyle pending |
| `#rider/home` | rider native `Home`, `HomeScreen` | assigned orders + history + presence API | Existing | V5 assignments screen implemented; local OTP login, 390px visual, availability on/off verified. No assigned order in local seed to exercise delivery card. |
| `#rider/pickup` | rider native `Delivery`, `DeliveryScreen` | rider order transition API | Existing equivalent | Mapped; v5 restyle pending |
| `#rider/delivery` | rider native `Delivery`, `DeliveryScreen` | rider order/location API | Existing | Mapped; v5 restyle pending |
| `#rider/proof` | rider native `Delivery`, `DeliveryScreen` | delivered OTP API | Existing equivalent | Mapped; preserve server validation |
| `#rider/history` | rider native `History`, `HistoryScreen` | rider history API | Existing | Mapped; v5 restyle pending |
| `#rider/cash` | no dedicated cash-handover UI | no verified handover API | Backend/product decision missing | Do not mark cash settled locally |
| `#rider/support` | issue reporting in delivery | rider issue/support API | Existing equivalent | Dedicated help route pending |
| `#rider/account` | profile/presence in `HomeScreen` | rider profile API | Existing equivalent | Dedicated account route pending |
| `#admin/dashboard` | admin web `/`, `Dashboard.tsx` | admin dashboard + analytics API | Existing | V5 shell/metrics/focus/chart/status/recent layout implemented with live API data; local login, 1280px/390px visuals and dark/Cobalt/reset preview verified. Nonzero charts unverified. |
| `#admin/orders` | admin web `/orders`, `Orders.tsx` | admin orders API | Existing | V5 heading/filter/table/empty state implemented; local API route and 390px visual verified. Order actions unverified with empty seed. |
| `#admin/merchants` | admin web `/merchants` | admin merchants API | Existing | Mapped; v5 restyle pending |
| `#admin/catalogue` | admin web `/products` | admin products API | Existing equivalent | Mapped; v5 restyle pending |
| `#admin/categories` | admin web `/categories` | admin categories API | Existing | Mapped; v5 restyle pending |
| `#admin/customers` | admin web `/customers` | admin customers API | Existing | Mapped; v5 restyle pending |
| `#admin/riders` | admin web `/riders` | admin riders API | Existing | Mapped; merchant relationship retained |
| `#admin/returns` | admin web `/refunds` | admin refunds API | Existing equivalent | Dispute workflow not fully verified |
| `#admin/support` | admin web `/support` | admin support API | Existing | Mapped; v5 restyle pending |
| `#admin/areas` | no route | no verified service-area admin API | Backend/product decision missing | Keep out of live navigation |
| `#admin/settlements` | admin web `/settlements` | admin settlements API | Existing | Mapped; v5 restyle pending |
| `#admin/commissions` | merchant detail commission controls | admin merchants API | Existing equivalent | No global commission rules route |
| `#admin/promotions` | admin web `/coupons` | admin coupons API | Existing equivalent | Mapped; v5 restyle pending |
| `#admin/cms` | no route | no verified CMS API | Backend/product decision missing | Keep out of live navigation |
| `#admin/reports` | dashboard analytics | admin analytics API | Existing equivalent | Independent report route pending |
| `#admin/roles` | no UI | API role guards; staff API | Backend/product decision missing | Do not add client-only permissions |
| `#admin/integrations` | no route | provider configuration outside UI | Backend/product decision missing | No secret editor assumed |
| `#admin/audit` | admin web `/audit` | audit API | Existing | Mapped; v5 restyle pending |
| `#admin/settings` | no settings route | no verified admin settings API | Backend/product decision missing | Keep out of live navigation |

## Current implementation boundary

Phase A route/API mapping is complete. The rendered v5 admin dashboard/orders, merchant dashboard, website/customer home, and rider home were inspected before implementation. Phase B adds portable semantic tokens and a review-only Theme Studio to admin and merchant web; it persists per origin using `sirfbazar.ui-theme.v5`, validates a strict v1 JSON schema and 32 KiB limit, offers eight presets, system/dark modes, sidebar/density/radius controls, and CSS/JSON export. It does not sync across origins or change business state. Phase C implements the selected web dashboards/order screens and native entry screens without replacing apps. The status above is narrower than the 68-view reference: unmarked detail screens, POS, unsupported concept modules, full native-device testing, and real nonzero order lifecycle/chart data are still pending.

## Verification on 27 September 2026

- `npx tsc --noEmit` passed: API, admin, merchant web, customer native, merchant native and rider native. Customer web `next build`, POS build and admin/merchant web Vite development-mode builds passed. Route-level code splitting removed the prior >500 KiB chunk warning.
- `node --experimental-strip-types --test apps/shared/design/theme.test.mjs`: 2 tests passed, including v1 validation, size limit, preset action/tint contrast and system-mode selection.
- Browser smoke: local admin email login, merchant web OTP login, rider and merchant Expo web OTP login; customer native shop navigation; customer website pantry category navigation; admin and merchant empty order routes; merchant web and rider availability toggled and restored; Theme Studio dark/Cobalt persistence and reset.
- Reference/live screenshots were compared at desktop and 390×844 for admin/merchant dashboards, merchant orders, website/customer home and rider home. All six entry surfaces were additionally checked for horizontal overflow at 320, 390, 768, 1024 and 1440px; none overflowed. A stacked/clipped mobile operations nav, clipped order empty state, 320px product action crowding and customer native slogan overlap were found and fixed during comparison. Browser screenshots are retained in the ignored `.playwright-cli/` folder.
- Local API is running at `http://localhost:3001/api` against the existing project volume mounted on port 5433. The volume was empty, so the schema was pushed and the documented local demo seed created 12 users, 12 categories, 44 products, 4 merchants and 5 merchant-owned riders. No production database was modified.

## Explicit limitations

Customer-mobile update: the later [customer mobile v5 report](CUSTOMER_MOBILE_V5.md) supersedes the earlier no-orders/checkout-not-tested limitation for this app. A real local COD test order was created and cancelled, support submitted, and the shopping/detail layouts implemented. The other applications' limitations below remain unchanged.

- The local seed contains no orders. Nonzero Recharts rendering, merchant order transitions, rider pickup/proof, refunds and checkout/payment were not visually verified. Empty states are real, not fictional studio records.
- Theme Studio is review-only in admin/merchant web. Customer web/Expo and rider Expo do not yet have the portable theme controls; legacy detail screens also need v5 state-by-state styling.
- Expo checks ran in the browser at mobile widths; Android and iOS devices were not available in this verification.
- Running `prisma db push` while the API held its Windows query-engine DLL synchronized the schema but emitted an `EPERM` during client regeneration. The existing generated client remained usable: API typecheck, seed, login and reads succeeded. A clean regeneration after stopping the API remains advisable.
- `npm audit --omit=dev` reports one high and one moderate React Router advisory in each admin/merchant web package. Dependency upgrade and regression checks remain a separate security follow-up; no advisory was silently dismissed.
- POS Vite development startup failed during esbuild dependency prebundling with a Windows/OneDrive `Access is denied` resolution error. The POS production build passed and its preview serves on `http://localhost:5175/`; only its login screen was visually smoke-tested in this pass. All eight local HTTP endpoints (API plus seven UIs) returned 200 at final check.

## Scoped interface review of changed entry surfaces

| Lens | Finding and disposition |
|---|---|
| Accessibility | Added semantic navigation, labelled search, table column headers, modal Escape/focus return and visible focus styles in web operations surfaces. Labelled the native customer search icon. Automated contrast tests cover preset action/tint pairs; a full assistive-technology and native-device audit remains open. |
| Layout and responsive behavior | Reference shell hierarchy is recognizable without shipping its demo rail. Browser checks found no document-level horizontal overflow across five widths on admin, merchant web, customer web and all three Expo web previews. Long data tables intentionally scroll within their panel. |
| Typography and writing | Headings and metric hierarchy follow v5. Copy distinguishes actual online orders from POS sales and merchant-owned delivery; empty order counts are not replaced by demo values. The approved single-line Urdu slogan is retained. |
| Color and UI states | Default green remains the baseline. Theme Studio preview was exercised in light, dark, Cobalt and reset states, with persisted reload; all eight presets passed action/tint contrast checks. Remaining legacy detail pages and native controls have not been reviewed state-by-state. |
| Reference fidelity | Implemented merchant orders and website home were compared with the rendered reference. The fictional grocery props in the reference hero were intentionally replaced with the approved basket artwork for production. Mockup rows, charts and a board-view affordance were not copied as if real data/features existed. |

Review verdict: the changed entry surfaces are suitable for local design testing, not a complete v5 rollout. Highest remaining UI work is the customer checkout/tracking and merchant/rider order lifecycle screens using real seeded orders and device checks.

## Customer mobile dark appearance correction — 27 September 2026

Scope: customer Expo app at port 8084, using its existing `useTheme` store and React Native styles. Compared the rendered `#customer/home` reference in original-green dark mode with the actual Home screen; inspected shared colors on Shop, Account and the empty Cart. Customer website and other apps were outside this correction.

| Domain | Evidence inspected | Result |
|---|---|---|
| Accessibility | Rendered heading, secondary text, Add action and appearance selector; labelled tabs/radios | Corrected action contrast and exposed selected appearance to web accessibility APIs |
| Layout | Home screenshots at 320px and 390px; overflow checks at 320/390/768px | No page overflow; existing horizontal shop/product strips remain scrollable |
| Writing | Existing home, account, empty-cart copy and exact one-line Urdu slogan | Clear within the appearance correction |
| Typography | Headings and small metadata in dark/light screenshots | Text remains legible; no font/layout redesign in this correction |
| Colors | Reference tokens and actual rendered foreground/background pairs | Removed mixed light/dark surfaces and aligned charcoal, border, secondary and accent colors with v5 |
| UI polish | Header logo, input, cards, hero and theme selection states | Corrected dark logo visibility and light-only home overrides |

| Severity | Domain | Location | Before | After | Why |
|---|---|---|---|---|---|
| HIGH (fixed) | Colors | `apps/customer-app/screens/HomeScreen.tsx`, `apps/customer-app/lib/theme.ts` | Light canvas and dark headings over the old brown-black card palette | v5 mobile panel `#1A1E22`, inset canvas `#111417`, text `#EDF1F4`, border `#30383E`; semantic home styles | Mixed themes obscured content and did not match the reference |
| HIGH (fixed) | Accessibility | `apps/customer-app/components/AddButton.tsx`, `screens/AddressEditScreen.tsx`, `components/CustomTabBar.tsx` | White text/checks on colors intended for accent or danger text | Solid action/danger fills separate from text colors | Filled controls retain readable foreground contrast |
| MEDIUM (fixed) | UI polish | `apps/customer-app/screens/HomeScreen.tsx` | Dark wordmark remained nearly invisible on the dark header | Existing approved horizontal mark renders in the theme's light foreground | Brand remains visible without replacing the approved asset |

Verification: customer `npx tsc --noEmit` and scoped `git diff --check` passed. Browser tests verified Light/Dark/System, system media changes in both directions, persisted Dark after reload, shop navigation and empty Cart. Rendered dark body contrast is 14.76:1, secondary text 8.03:1, white Add text 5.38:1, selected appearance 4.65:1. Screenshots: `.playwright-cli/customer-dark-home-320.png`, `customer-dark-account.png`, `customer-dark-shop.png`, `customer-dark-cart.png`, `customer-light-home.png`. Android/iOS device rendering and the complete order lifecycle were not re-tested for this palette correction.

Verdict: Approve for the inspected appearance scope; broader v5 layout gaps in the route map remain unchanged.
