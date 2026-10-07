# Frontend testing and correction checkpoints

Recorded: 27 September 2026.

These checkpoints capture the user's reported problems and requested improvements. They remain **open** until every acceptance item is verified. The implementation pass below records what has actually been changed and tested; an HTTP 200 alone does not prove a workflow works.

## Implementation pass — 27 September 2026

This is an active checkpoint, not a declaration that every item below is complete.

| Area | Implemented and observed | Still open |
|---|---|---|
| Customer website | Header account icon now opens `/profile` for guests and customers; phone OTP sign-in completed on the local API with a dev test account. Profile now shows an API error/retry instead of waiting forever. A key-free map picker opens without a Google Maps key; a moved pin saved to a local test address, persisted after reload, and the test address was deleted. | Checkout selection, wrong/expired OTP, Google provider, denied GPS, dark/narrow visual states, and production tile hosting need separate checks. |
| Customer mobile | Home location is actionable. The new delivery-location screen offers explicit GPS or a clearly named Lahore demo-browsing choice; Home no longer replaces a chosen location because shops are empty. GPS was emulated in the Expo web preview and the selected label persisted after reload. An out-of-service GPS location now shows a no-shops message and Change location action, also browser-tested. | Saved-address/checkout integration, denied GPS, native Android/iOS, and light/dark comparisons remain. Manual non-GPS real-location selection is not yet available. |
| Merchant web | Shared header reads shop status from `/merchant/profile`, refreshes on navigation, status changes and a 30-second interval; it remains visible across all six tabs. Shop settings uses a map pin instead of latitude/longitude inputs. Existing pin was confirmed, saved and present after reload. | Address search and map-to-address reverse geocoding are not implemented; use address/city/area text fields with the map pin. Nearby-shop impact and permission-denied state need checks. |
| Admin web | Header has a working page-finder and Settings control. Settings explicitly reports that platform preferences/permissions have no editable API and links to Theme Studio. All 12 existing routes and all six merchant routes loaded with local API data and no page-level alert in a browser smoke pass. | Finder searches page names, not marketplace records. Reference notification/date/account controls, per-tab detailed actions/states and full dark/responsive screenshot parity remain open. |

Evidence: `output/playwright/admin-overview.png`, `output/playwright/admin-dark.png`, `output/playwright/merchant-settings.png`, `output/playwright/merchant-shop-map.png`, `output/playwright/customer-mobile-home.png`, `output/playwright/customer-web-map.png`, `output/playwright/reference-admin-overview.png`, `output/playwright/reference-merchant-overview.png`, `output/playwright/sb-admin-mobile.png`, `output/playwright/sb-merchant-mobile.png`.

Interface review: the admin reference header has a broad search, date, notification bell, settings and account avatar. The live admin header now has a clearly scoped page finder and settings control, but date/notifications/avatar remain different because their operational behavior has not been mapped. The reference's top design-suite rail is prototype navigation, not an app feature to copy. Reference metric values are fictional; the app correctly shows local API data. At 390px, the admin page finder collapses to a focusable icon and the merchant online label stays visible, though the merchant header still needs spacing refinement. The admin overview was visually checked in light and dark; other tabs/themes are smoke-tested only.

Checks completed so far: TypeScript no-emit for web, customer mobile and admin; merchant TypeScript as part of its build. Admin/merchant Vite local-preview builds require `--mode development --configLoader runner`; ordinary production-mode builds point to the production API by design. Live preview browser checks were run against local API `http://localhost:3001/api`. No native-device verification is claimed.

### WEB-01 follow-up: profile permission error

Reproduced against the local API with a merchant account using customer-context OTP: `/customer/profile` returned 200 before refresh and 403 after refresh. The refresh service discarded the customer app role and minted the user's base merchant role. Refresh tokens now store their issued role, revalidate the matching capability, and rotate with that role. The website explicitly requests customer context and converts a legacy 403 session into a customer sign-in prompt instead of displaying the raw permission error. Its concurrent profile/address requests also share one refresh so a second request does not invalidate the first. The local database schema was updated without resetting data. Browser checks confirmed legacy-role recovery, customer sign-in, refreshed `CUSTOMER` role and profile persistence after reload; a forced-expired access token produced one refresh request and a loaded profile. Merchant and admin refreshes were separately checked to retain their roles. The narrow recovery sheet was visually checked at 390px (`output/playwright/profile-session-recovery-mobile.png`), and Escape closed it.

## 1. Customer website — http://localhost:3002

### WEB-01 — Profile page and profile icon

- [ ] Reproduce the missing profile page at http://localhost:3002/profile as both a guest and a signed-in customer.
- [ ] Check the header's account/profile icon on desktop and mobile, including light and dark themes.
- [ ] Ensure the icon is visible, has an accessible name, and opens the intended account/sign-in destination.
- [ ] Verify signed-in profile data, loading/error states, refresh persistence, logout and expired-session handling.
- [ ] Record before/after screenshots and the actual API result.

Done when: the profile is reachable from the icon and direct URL; guests receive a clear sign-in path; signed-in customers see their own data without a blank screen.

### WEB-02 — Sign-in failure

- [ ] Reproduce the failing sign-in entry points: header, profile and checkout.
- [ ] Inspect browser errors, failed requests, local API configuration and CORS before identifying a cause.
- [ ] Check phone/OTP request, verification, incorrect/expired codes and retry feedback.
- [ ] Check Google sign-in separately if exposed; record provider-configuration blockers rather than treating mock authentication as production verification.
- [ ] Verify session persistence, logout, return to the previous screen and guest-basket merge after successful sign-in.

Done when: each supported sign-in method completes or explains its specific configuration blocker, and the customer returns to the intended workflow with their basket intact.

### WEB-03 — Map location cannot be saved

- [ ] Reproduce map loading, address search, current-location detection and pin selection.
- [ ] Test location permission allowed, denied and unavailable; provide manual map/address selection when GPS is unavailable.
- [ ] Verify the selected pin, displayed address and saved coordinates refer to the same location.
- [ ] Save an address, reload the page, reopen it and verify it can be selected at checkout.
- [ ] Inspect save validation/API errors and map/geocoding provider configuration without exposing keys.
- [ ] Confirm the app does not report success or silently switch to a demo location when detection/saving fails.

Done when: a customer can choose a location, save it, reopen it and use it for delivery.

## 2. Customer mobile app — http://localhost:8084

### MOBILE-01 — Location not working

- [ ] Reproduce location selection from Home and delivery-address/checkout flows.
- [ ] Separate browsing/service-area location from a saved delivery address; verify each updates the intended state.
- [ ] Check browser geolocation, permission failures, map selection, reverse geocoding and local API responses.
- [ ] Verify manual selection works without GPS and previously selected values are not silently replaced by the seeded demo area.
- [ ] Save and reload an address; confirm nearby shops and checkout use the appropriate selected location.
- [ ] Test at narrow mobile widths and in light/dark mode. Record Android/iOS checks separately if devices are available.

Done when: location selection and saved-address workflows work in the Expo web preview with clear failure/retry paths. Native device behavior must not be claimed without device testing.

## 3. Admin panel and merchant web — design audit

Reference: `design-reference/SirfBazar_Design_Studio_v5.html`, with the accompanying implementation and branding documents.

### ADMIN-01 — Header and missing controls

Admin: http://localhost:5176/

- [ ] Compare the complete header against the admin reference: alignment, spacing, breadcrumb/title, search, settings, account and any other reference controls.
- [ ] Record each control as implemented, missing, visually mismatched, intentionally unsupported or blocked by a missing API/permission.
- [ ] Verify search behavior and its empty/error states; do not add a decorative input with no functioning search.
- [ ] Map Settings to a real supported destination, or record the missing settings capability as a blocker. Theme Studio is not a substitute for application settings.
- [ ] Check the header across every existing admin tab, desktop/mobile widths and light/dark themes.

Done when: every header difference has evidence and disposition, and implemented controls work with existing permissions.

### PANELS-01 — Check every tab against the design

For each tab below, check header/sidebar, page hierarchy, typography, cards/tables, filters/search, actions, loading/empty/error states, keyboard access and responsive light/dark layouts. Capture actual/reference screenshots and record differences before marking a row complete.

| Checked | App | Existing tab | URL |
|---|---|---|---|
| [ ] | Admin | Overview | http://localhost:5176/ |
| [ ] | Admin | All orders | http://localhost:5176/orders |
| [ ] | Admin | Merchants | http://localhost:5176/merchants |
| [ ] | Admin | Catalogue moderation | http://localhost:5176/products |
| [ ] | Admin | Categories & units | http://localhost:5176/categories |
| [ ] | Admin | Customers | http://localhost:5176/customers |
| [ ] | Admin | Merchant riders | http://localhost:5176/riders |
| [ ] | Admin | Returns & refunds | http://localhost:5176/refunds |
| [ ] | Admin | Support inbox | http://localhost:5176/support |
| [ ] | Admin | Settlements & COD | http://localhost:5176/settlements |
| [ ] | Admin | Promotions | http://localhost:5176/coupons |
| [ ] | Admin | Audit activity | http://localhost:5176/audit |
| [ ] | Merchant | Overview | http://localhost:5174/ |
| [ ] | Merchant | Online orders | http://localhost:5174/orders |
| [ ] | Merchant | Products | http://localhost:5174/products |
| [ ] | Merchant | My riders | http://localhost:5174/riders |
| [ ] | Merchant | Settlements & COD | http://localhost:5174/earnings |
| [ ] | Merchant | Shop settings | http://localhost:5174/profile |

- [ ] Also check both login screens and protected-route redirects.
- [ ] Inventory reference tabs that do not exist in the actual apps. Report missing workflows/APIs separately; do not manufacture dummy pages to claim design completion.

## 4. Merchant web panel — http://localhost:5174

### MERCHANT-01 — Persistent header online status

- [ ] Place the shop's server-confirmed online/offline status in the shared header so it remains visible on every merchant tab.
- [ ] Use text and an icon/indicator, not color alone; preserve visibility at narrow widths and while scrolling.
- [ ] If an online/offline switch is exposed there, enforce the existing permissions, show pending/error states and reflect the confirmed server state after reload.
- [ ] Distinguish the merchant's availability switch from actual customer visibility: approval, opening hours and service-area rules may still prevent a shop from accepting orders.
- [ ] Verify the customer-facing shop status changes consistently with the backend; never label a failed update as live.

Done when: the merchant can always identify the shop's actual availability from the shared header, with any restriction clearly explained.

### MERCHANT-02 — Map-based shop location

- [ ] Replace the primary latitude/longitude-number entry experience with an interactive map picker in Shop settings/onboarding where applicable.
- [ ] Support address search, current-location detection where available, and pin placement/movement.
- [ ] Initialize the map from the existing saved shop coordinates; synchronize pin, address and coordinates.
- [ ] Keep numerical coordinates optional/secondary if useful, not the only way to choose a location.
- [ ] Save through the existing merchant-scoped API; reload and verify persistence.
- [ ] Check the impact on nearby-shop results, service radius and customer delivery eligibility using local test data.

Done when: a merchant can accurately choose and save the shop location from the map without needing to know coordinate numbers.

## Suggested execution order

1. Reproduce and resolve website sign-in, then profile/icon behavior.
2. Diagnose shared map/location dependencies; verify website and customer mobile flows separately.
3. Implement/verify merchant map selection and persistent availability header.
4. Audit both operations headers and all 18 existing tabs against the reference; implement supported corrections in app-specific phases.
5. Repeat cross-app regression checks and document specific remaining blockers.

## Completion evidence required for each checkpoint

- Reproduction steps and affected user/session state.
- Confirmed cause, or an explicit unresolved blocker.
- Files changed, if implementation is performed.
- Screenshots showing relevant reference and actual states.
- Narrowest relevant typecheck/build and browser workflow result.
- Local API only: `http://localhost:3001/api`; preserve auth, tenant boundaries, approved branding and merchant-owned riders.
- Six interface review lenses: accessibility, layout, writing, typography, colors and UI polish. Uninspected states remain marked not verified.

No application code was changed while creating this checkpoint document.
