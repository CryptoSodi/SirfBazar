# Codex — reproduce the selected SirfBazar Rider design

Use this prompt when native implementation is explicitly requested. Supplying this design alone does not authorize production test writes.

```text
Implement the supplied SirfBazar Rider mobile design in the EXISTING rider app.
This is a faithful design reproduction and existing-API integration task,
not a new visual direction, WebView wrapper or replacement backend.

FIRST READ
Read repository instructions and these design-pack files:
- SIRFBAZAR_RIDER_APP_DESIGN.md
- API_CONTRACT_MAP.md
- SirfBazar_Rider_Design.html and rider-design.css
- screens/, SCREEN_INDEX.md, theme-tokens.ts and assets/
- QA_REPORT.md and SOURCE_MANIFEST.json

Verify REFERENCE_LOCK.json with tools/verify_reference.py.
Do not regenerate reference screenshots to make an implementation test pass.

Inspect CryptoSodi/SirfBazar/apps/rider-app, actual React Native/Expo versions,
React Navigation routes, auth/session/refresh, Google sign-in, permissions,
location/push setup, and apps/api rider/auth/order contracts. Reuse the active
workspace even if its frontend checkout is separate. Do not create a second
rider app, migrate SDK/router, reinstall every dependency or copy native
screens into the merchant Vite project. Preserve uncommitted work.

The configured API target is:
EXPO_PUBLIC_API_URL=https://api.sirfbazar.com/api

Use the existing native API client and session conventions. VITE_API_URL is
for the merchant web app, not this app. Include /api once. Inspect current
controllers, DTOs and deployment differences; the source-read manifest is
not proof that every deployed response is identical. Never use GroceryServer.

VISUAL LOCK
Use the same composition, supplied basket wordmark, semantic tokens, spacing,
font hierarchy, cards, badges, 54-unit actions, icon paths, bottom navigation,
and sheet styles. Match all referenced states in Light and Dark, plus System.
System responds to the actual device appearance only while selected.

Navigation is Deliveries, History, Help, Profile. Delivery detail replaces
bottom tabs with a clear next-action dock. Use actual native safe areas,
status bar and keyboard handling; do not draw the prototype's fake clock.
Keep the slogan as the supplied single horizontal RTL artwork:
بازار وہی۔ طریقہ نیا۔

The source font is Plus Jakarta Sans with Inter/Arial browser fallbacks.
The browser reference uses local fallback fonts, not bundled font files.
Use the project's approved native font setup and compare at matched logical
sizes; do not scale 2x PNG pixels into dp or conceal font differences.

Use native components and navigation, not HTML-in-WebView, screenshot-only
screens or the prototype's innerHTML renderer. Reuse original logo PNG/SVG
geometry and icons. Choose existing native SVG/image support; do not add a
new library without a concrete need. Keep appearance and motion consistent.

CONNECT THE MAIN WORKFLOW
- GET /rider/profile and /rider/orders/assigned.
- GET /rider/orders/:id.
- POST arrived-shop, picked-up and arrived-customer only in supported states.
- POST delivered with { otp } and only supported optional fields.
- Refetch assigned list, profile and detail after a confirmed result.
- History GET /rider/orders/history, with its real 50-record cap and no fake
  lifetime earnings/delivery counts.
- POST /rider/orders/:id/report-issue with meaningful { description }.
- Online/offline through their existing actions, not cancellation of work.

The merchant assigns orders. Do not add Accept job, Decline job, reassign,
open-market jobs, rider earnings, cash-balance or handover endpoints.
Rider-owned APIs only; do not impersonate merchant/admin/customer operations.

SOURCE RULES
Pickup can occur from RIDER_ASSIGNED or RIDER_ARRIVED_AT_SHOP. It records a
PICKED_UP timeline event and returns main status ON_THE_WAY. Arrival records
RIDER_ARRIVED_AT_CUSTOMER. Completion is accepted from ON_THE_WAY or that
arrived state in inspected source; preserve permitted recovery paths.

The customer's delivery code is not the rider login OTP. Verify the current
4-digit generator instead of inheriting the login input's assumptions. Never
retrieve, prefill, log, cache or expose deliveryOtp from any rider response.

For COD show the verified order cash instruction; check both method and
payment status to avoid duplicate collection. For confirmed PAID show no cash.
Other states need accurate explanation and support, not an invented payment
rule. Package and cash checkboxes are local UX acknowledgements, not extra
API fields, a cash-handover system or server idempotency.

Disable duplicate submits. On timeouts, reconcile saved status before retrying;
never auto-replay delivery, report, signup or presence mutations. Do not show
reporting success after caught errors. Read-only mode with stale cached
addresses is not permission to mark an order delivered offline.

SIGN-IN / JOINING
Preserve existing phone OTP and Google flows with context rider. Never use
admin password login or merchant CNIC fields. Existing linked riders skip
application. Unlinked riders search /rider/shops and apply using current DTO.
Pending shop approval and inactive accounts are separate from offline status.
Do not self-approve or recreate memberships on retries. Keep cancellation,
wrong-code, throttling, auth-expiry and absent-rider states explicit.

LOCATION AND CONTACT
The illustrated map in the reference is NOT real map data. In normal app
screens replace it with a configured native map using real data, or an honest
nongeographic pickup/drop-off card. Preserve layout and record this platform
adaptation. Do not pretend a drawn line is directions or invent distance/ETA.
Keep external navigation/dialer hand-offs using verified destination/contact.

Request permissions when needed, not all at login. Gate location collection
to consent and the intended active-delivery lifecycle. Opening maps, screen
lock and process termination need real-device testing. Foreground pings are
not a proven background-tracking solution. Show denied/unavailable/stale state
and stop collection when appropriate. Never fake GPS coordinates.

LIGHT / DARK / SYSTEM AND ACCESSIBILITY
Theme controls live in Profile/Appearance. Persist validated device preference
without turning localStorage/AsyncStorage into a fake orders database. Changes
must retain code/notes, selected task, scroll, stack and pending requests.
Use 140–200ms restrained feedback, no bouncing logo, countdown pressure or
animated false GPS. Honor OS reduced motion and native screen-reader labels.
Test large text, hardware back, focus return and keyboard-safe action placement.

PRODUCTION BOUNDARIES
Normal app screens use real API; fixtures only in isolated local stories/tests.
Remove preview rail, API notes, sample notices, fake status bar, review menu,
window.__riderDesign and sample data from production. Never silently load
fixtures on request failure. Do not present native permissions/calls as
working because the browser has a demonstration sheet.

Do not modify apps/api, run migrations/seeds, deploy, trigger OTPs, approve
riders, send support messages or complete live orders to demonstrate a design.
Authenticated tests need approved accounts and test records. Missing access
blocks that verification, not independent UI implementation.

Record identified backend concerns: assigned-order OTP serialization,
mock-mode delivery bypass, status/approval enforcement, partial completion
side effects and source/deployment differences. Frontend hiding is not a
security repair. Request separately scoped backend work rather than bypassing
checks or claiming it is fixed.

VERIFY AND DELIVER
Build all selected screens/states. Run available type checks, native build
checks and component/integration tests. Capture comparable native screenshots
at logical 390x844, 360x800, 412x915 and larger text, in both themes. Use fixed
fictional fixtures only for local parity; actual app routes remain protected.
Compare spacing, colors, assets, wrapping, controls and sheets, and correct drift.

Verify the workflow on authorized test records when available: merchant assigns
→ correct rider sees order → pickup → arrival → code + payment acknowledgement
→ confirmed delivery → refetch/relaunch → merchant sees matching status.

Report exact files changed, screens implemented, contracts checked, API calls
connected, actual test evidence, native screenshots and remaining gaps. Keep
visual parity, source inspection and live/native verification separate. Do not
claim pixel-perfect native parity, uninterrupted tracking, production security
or all platform APIs integrated without evidence.
```
