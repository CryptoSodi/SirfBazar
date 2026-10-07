# SirfBazar Rider — mobile design and interaction specification

**Version:** 1.0 · 29 September 2026  
**Product:** Merchant-owned rider mobile application  
**Existing application:** `CryptoSodi/SirfBazar/apps/rider-app`  
**Existing backend:** `CryptoSodi/SirfBazar/apps/api` (NestJS/Prisma)  
**Owner-supplied API target:** `https://api.sirfbazar.com/api`

> This is an interactive design and implementation handoff. The HTML, examples, status bar, route illustration and screenshot records are fictional. No live login, API request, GPS tracking, phone call, message, payment or assignment is performed by this pack. Do not publish the prototype as the native rider application.

## 1. What to build

Refine the **existing** rider app rather than create a second rider project. Its inspected package uses React Native, Expo, React Navigation, safe-area context, location, notifications and native Google sign-in. Preserve the actual installed dependency versions and existing authentication transport; this design is not an instruction to install the newest SDK or reconstruct the backend. [C1]

The product is a rider's physical-work companion, not a smaller merchant dashboard. It answers four questions: Which delivery is mine? Where do I go now? What must I collect or hand over? Has the update actually been saved?

The merchant controls assignments. Riders see their assigned deliveries and perform only their own authorized progress actions. No open job marketplace, bids, accepting a job, assignment-expiry countdown, salary dashboard or ability to switch shops is created by this design. The current API does not establish these capabilities. [S1, C2, C3]

### Product sequence

```text
Merchant assigns a ready order using the existing merchant API
    → rider receives/refreshes assigned orders
    → rider opens delivery detail
    → arrives at shop
    → checks order and confirms pickup
    → navigates to customer
    → records arrival
    → verifies parcel handover, payment instruction and customer delivery code
    → backend confirms completion
    → rider and merchant refetch saved progress
```

This is the recommended UI sequence. The actual service also allows pickup directly from `RIDER_ASSIGNED`, and completion from `ON_THE_WAY`; do not describe the UI's preferred sequence as a stricter existing server rule. [C3]

## 2. Evidence and precedence

The owner's current source is `apps/api`, not the old GroceryServer document. The startup log establishes routes, not request/response contracts. The rider controllers, services, auth DTO, and selected native screens were read through the connected repository for this design. Their file hashes are recorded in `SOURCE_MANIFEST.json`. Default-branch source can differ from the deployed server; no authenticated deployment testing was performed. [S1, C1–C7]

Distinguish:

- **Source-supported:** routes, fields, statuses and behavior identified in the inspected code.
- **Designed here:** visual composition, navigation grouping, wording, local safety acknowledgements and motion.
- **Requires native implementation:** OS permission sheets, native maps/dialer hand-offs, background tracking, native accessibility and actual notifications.
- **Requires verification or backend work:** the release questions in section 13. Do not fix these by pretending the UI enforces server security.

Reuse the approved merchant v2 basket artwork and semantic theme family. This rider composition is new, not a literal desktop-to-phone conversion. Maintain existing repository instructions, working app capabilities and the owner's later decisions.

## 3. Brand, appearance and layout

### Identity

Use the supplied original SVG basket/wordmark, unchanged in geometry. Role text `RIDER` is a separate label, never part of a new logo. Store icons are ordinary interface icons; they must not replace SirfBazar's basket. No leaf logos, shopfront wordmark, SB monogram, cartoon rider mascot or new orange delivery-company brand.

The exact slogan remains one horizontal RTL unit:

**بازار وہی۔ طریقہ نیا۔**

Use the supplied outlined slogan; its layout and text order are not to be retyped or reversed. The original light SVGs are preserved. Dark PNG display derivatives use the same outlines in the light foreground color. Font files are not bundled.

### Theme tokens

Full values are in `rider-design.css` and `theme-tokens.ts`. Essential mappings:

| Role | Light | Dark |
|---|---|---|
| Identity | `#009966` | `#009966` |
| Primary action with white label | `#007A52` | `#007A52` |
| Canvas | `#F7F8F5` | `#101614` |
| Surface | `#FFFFFF` | `#19221E` |
| Secondary surface | `#F0F4F0` | `#233027` |
| Main text | `#071F18` | `#F0F6F1` |
| Secondary text | `#52695D` | `#B0C2B7` |
| Accent text | `#007A52` | `#73DEAD` |
| Control boundary | `#7E9387` | `#789486` |
| Focus | `#4762CC` | `#A7BAFF` |
| Featured delivery | `#07563E` | `#134D39` |

Preserve Light, Dark and System. In System mode only, follow changes in device appearance. Remember the appearance choice without persisting customer data as a fake local database. Theme changes must not reset the selected delivery, online state, notes, form input, pending request, navigation stack or scroll.

Apply tokens to screens, safe areas, cards, buttons, icons, disabled controls, form fields, sheet backdrops, history statuses, maps/fallback cards and validation. Dark mode is a complete surface system, not a CSS inversion filter. The primary CTA remains recognizable in both themes.

### Geometry and typography

Reference canvas: **390 × 844 logical units**, with 2× screenshot exports. Verify 360 × 800, 412 × 915 and larger text on native devices as well. Do not convert physical screenshot pixels directly to React Native dp/points.

Use the chosen Plus Jakarta Sans family, with the source's Inter/Arial fallback for browser review. The contained prototype performs no font download, and local screenshots use the installed fallback. The supplied logos do not depend on fonts. Record and match font conditions for screenshot comparison.

Page padding is 20; ordinary gaps 8/12/16/20/24; prominent headings 28 with tight but readable line height; card headings 16; body 14–16; secondary text 12–13; bottom labels 10–11. Essential address and payment content must never rely on tiny metadata. Primary buttons are at least 54 high, secondary touch controls generally 44–48, and action icons have padded targets. Provide native text scaling and content wrapping rather than scaling the entire screen.

Cards use 20 radius, the featured next-delivery card 22, buttons 14, sheets 26 on top corners. Use boundaries and spacing rather than heavy drop shadows. The simulated browser status bar is a review aid: the real app must use platform status/safe areas, never draw a fake 9:41 clock.

## 4. Navigation and information architecture

**Deliveries · History · Help · Profile**

Keep these four bottom destinations. A delivery detail uses a compact back/header/help row and a bottom primary-action dock instead of competing bottom navigation. Android hardware back and screen-reader focus must follow the actual navigation stack. A back action never marks delivery progress.

The top-level Deliveries view includes the approved wordmark, a small Rider label and notifications. No language toggle is presented without an implemented localization system; the Urdu slogan alone does not make the app bilingual. Existing localization can be retained if present.

Home shows the rider's linked shop. There is no global merchant picker for an established rider. An account with no rider association follows the join-shop flow instead. [C3, C4, C6]

## 5. Working screens

### R01 — Your deliveries

A merchant-context line, heading, rider initials and online control precede a single prominent delivery card. The card shows order number, pickup shop/address, customer/area, item quantity, correct payment instruction and **View delivery**.

The featured record should use a valid `currentOrderId` that appears in the assigned response, or a clearly selected assigned order. The backend list is ordered by assignment time descending, not route priority. Do not advertise optimization, nearest-first dispatch or deadline priority. All other assignments remain accessible; the preview includes a second illustrative task.

The two compact summary cells show **Assigned deliveries** from a successful list and **Your delivery shop** from the linked profile. No earnings, daily streak, accepted-job percentage or all-time delivered count is invented. Empty and failed data are different.

The online switch uses `/rider/online` and `/rider/offline`; show pending and confirmed results. Going offline does not unassign or cancel existing work. Approval, activation, connection, foreground/background location and online presence are separate states. The inspected source does not establish a guarantee that offline riders cannot be assigned. [C2, C3]

### R02 — Assigned delivery

Show current order identity/status, pickup location, next drop-off and a practical payment note. **Navigate** opens the system maps hand-off; **Call shop** opens the dialer after deliberate user action. Neither changes the order status.

Primary CTA: **I’m at the shop**. A secondary path permits the source-supported direct pickup flow when already collecting the parcel. An assigned order is not waiting for a rider acceptance; omit Accept/Reject job buttons and timeouts.

### R03 — Pickup confirmation

Show the correct shop/order number and snapshot item names/quantities. Group packed-order checks so the rider is not asked to inspect sealed goods. A local checkbox says they matched the order number and collected the packed items. It is a proposed UX acknowledgement, not a stored per-item API field.

**Confirm pickup** opens a compact confirmation sheet, then submits the existing pickup action. Disable repeat submission while pending. The server appends a `PICKED_UP` timeline event and changes the main state to `ON_THE_WAY`; do not require the main status to remain `PICKED_UP`. [C3]

Display item exceptions accurately when returned. Never count unavailable/rejected replacements as packed goods without inspecting item status. The preview has only ordinary confirmed items; production needs the real item-status mapping.

### R04 — On the way

The customer's address, instructions and navigation/call actions are prominent. The prototype's small neighborhood illustration is explicitly **not live GPS**. Production must replace it with a properly configured native map, verified route, or an honest nongeographic pickup/drop-off summary. It must never display this fictional street line as a real route.

There is no invented distance or time-to-arrival. The delivery's estimated duration, when returned, must not be relabeled as travel time without verifying its definition. The default integration continues the existing external navigation approach. Show address-only fallback when coordinates or maps are unavailable. [C5, W2]

Primary action: **I’ve arrived**. Use only when safely stopped; no countdown that encourages interacting while riding.

### R05 — At the customer

Show the customer, address and correct payment instruction. Hand over the package, collect cash where required, and ask for the **customer delivery code**, not a sign-in OTP.

Primary action **Confirm handover** opens R06. There is no automatic completion based on location or timer. **Customer unavailable? Get help** opens the reporting flow without cancelling delivery.

### R06 — Cash and delivery-code verification

The inspected order generator creates four numeric delivery-code digits; `DeliveredDto` itself only validates a nonempty string. The reference uses a four-digit input for this current generator, while Codex must verify the deployed generator rather than copy the login input's six-digit assumption. Do not enter, retrieve, prefill, log, cache or expose `deliveryOtp` from rider responses. [C2, C3, C7]

For COD, show the specific authorized order amount, a parcel-handover acknowledgement and **I collected Rs … in cash**. For verified `paymentStatus=PAID`, show **Payment confirmed — do not collect cash** and omit cash acknowledgement. Non-COD alone does not establish payment success. For pending/failed/unknown financial states, show the recorded state and direct the rider to the shop/support rather than inventing a collection rule.

The parcel/cash checkboxes are proposed local safeguards. They are not extra request properties; the current body is `{ otp, photoUrl?, note? }`. Partial cash, tips, making change, issuing refunds and QR payment collection are not introduced. The source automatically marks COD cash collected during completion; this design does not prove a separate payment ledger or merchant handover. [C3]

Use one accessible input, visually styled for separated digits, rather than four unrelated focus traps. Delivery-code input must not request sign-in SMS autofill. Code mismatch, expiry, request rejection, lost connection and uncertain outcome are distinct states. The primary action only succeeds after a confirmed backend response and refetch.

### R07 — Completion receipt

Show order number, merchant, delivered status and factual payment summary. A small check animation is sufficient; no confetti, rider earnings, reward coins or invented ratings. **Back to deliveries** refreshes the assigned list and profile.

For cash, explain that collection is not acknowledgment from the merchant. No cash-balance or handover-confirmed statistic is shown, because no dedicated rider cash-handover contract was identified. Delivery progress must also update on the merchant's own view through the existing backend.

### R08 — Verified paid variant

Identical completion hierarchy, but explicitly paid status and **no cash collection**. Unknown or failed online payments must not use this design state. The same customer-code verification still applies. [C3]

## 6. History, help and profile

**R09 History:** List recent delivered and exception records with order number, source time/status and clearly labeled order value. Filter the loaded response only. The current history service returns at most 50 nonactive records sorted by created time, including failures/cancellations; it is not an all-time delivered list. No pretend pagination or lifetime summaries. Each detail uses rider-authorized detail reads. [C3]

**R10 Help:** Shop contact first for physical delivery questions, then order issue reporting, app/account support and own support requests. Do not promise round-the-clock human response, emergency dispatch, live chat, masked phone numbers or an escalation SLA. A safety note directs immediate danger to local emergency services without claiming the app provides that service.

**R11 Report issue:** Choose a category and enter meaningful context. The existing order issue API accepts `description`, so selected category text is prefixed in the description; do not invent an `issueType` property. Show the saved result only after success. Reporting leaves the delivery unchanged. A failed send must not show “Issue reported.” General app/account tickets use their separately verified support contract. [C2, C3]

**R12 Profile:** Rider name, contact, linked merchant, vehicle, activation/approval, preferences and sign-out. These are read-only unless a rider self-edit endpoint is verified; merchant rider-edit routes do not authorize rider self-editing. No change-shop feature. Sign-out warns that existing work is not cancelled and clears private cached state using the actual session implementation.

**R13 Appearance:** Light, Dark and System with a live component preview. System follows OS state only while selected. Preserve forms and order progress. Reduced motion follows the OS/accessibility preference.

**R14 Location and alerts:** Explain why access is needed, then invoke genuine OS permission flows in the native app. Denial offers readable addresses, navigation hand-off and help, rather than falsely reporting location sharing. Labels should say what is happening now: foreground access, background access, location disabled, last update failed or permission denied. Do not equate an Online flag with active tracking. [C5, W1]

## 7. Sign-in and rider joining

**R15 Sign in:** Phone with country-prefix treatment and Continue with Google. Do not inherit merchant password or CNIC forms. The default field is empty; remove hardcoded demo phone/code banners from production. The prototype's sample entry paths never send an SMS. [C4]

**R16 Verify phone:** Auth code with resend and change-number options. The login DTO accepts `phoneNumber`, `code`, optional name and `context:'rider'`. Code length and cooldown must match deployed service/provider behavior; the prototype's 4–6 digit acceptance is not a production contract. A verified rider enters Deliveries; an unlinked user proceeds to shop selection. Native Google cancellation is not an account-creation error; inspect the existing broad catch/retry before using customer-context fallback. [C4, C6]

**R17 Find shop:** `GET /rider/shops?q=...` returns approved shops and is capped at 50 in inspected source. Show name/address/city/area; no computed nearest sorting. Existing linked riders skip this step. No mock shop when a real search fails. [C3]

**R18 Rider details:** Selected merchant plus fullName, phoneNumber and optional vehicleType/vehicleNumber. Optional profileImageUrl exists in the DTO, but camera/upload is not mandatory in the design. Do not invent CNIC collection, license approval, training steps, pricing or subscription requirements. Use normalized phone and safe image storage only if the actual upload contract is verified. [C6]

**R19 Pending:** The application creates a pending/inactive rider record and issues updated rider-context tokens. Show the selected shop, pending decision and refresh/support. No self-approval, reapply loop or switch-shop button. A rejected/deleted association needs session/profile reconciliation; no automatic duplicate account creation. This rider-to-shop approval is separate from the owner's merchant self-service onboarding requirement. [C3]

## 8. Recovery and edge cases

| State | UI behavior |
|---|---|
| R20 No assignments | Only after a successful empty response. Refresh and contact shop. No auto-match promise. |
| R21 Connection lost | Last confirmed delivery labeled stale; cached address is available if approved cache policy permits. No offline success. |
| R22 Loading | Stable skeletons; no fake zero orders. |
| R23 API unavailable | Persistent retry; do not fall back to sample records. |
| R24 Session expired | Hide private information and return through verified auth. |
| R25 Account inactive | Contact owning merchant; presence cannot reactivate membership. |
| R26 Completion uncertain | Refetch saved state before retrying. Do not recollect money or auto-replay completion. |
| Wrong delivery code | Inline error, retained valid context, no fabricated resend endpoint. |
| Permission denied | Explain current capability; addresses and help remain available. |
| Order removed or reassigned | Refetch; clear forbidden customer data; explain that the assignment changed. |
| Unknown order status | Neutral literal/safe label; no guessed action. |
| Multiple deliveries | Keep each order identity explicit; do not invent batching or capacity guarantees. |
| Missing address/contact/map | Fallback to verified fields, contact shop and show unavailable actions honestly. |
| App background/restart | Reconcile with backend before taking another action; do not trust local flags. |

## 9. Location, privacy and device behavior

The existing Delivery screen requests foreground location and sends approximately 15-second pings while its effect is mounted. Its effect is not a verified background-tracking implementation and does not clearly gate collection to actual active status. The redesign should scope collection to the intended active-delivery/consent conditions and make failures visible; that is frontend integration work to verify, not already implemented by the reference. [C5]

Opening an external maps app changes app lifecycle. Expo background location needs separate configuration/permissions and can stop when the app is terminated; test real devices before promising tracking through screen-lock, app switching, low power and process termination. The normal web preview cannot validate these behaviors. [W1]

Use order-bound coordinates only for authorized active work. Never insert fake positions when GPS fails, show a stale marker as live, track a rider after completion by accident, expose a customer address outside the relevant task, or put real records in Google Stitch prompts. No continuous background-tracking permission is requested at first login merely because a location package is installed.

Cash acknowledgements and code input must not appear in analytics, logs, screenshots of real data, crash metadata or test fixtures. Do not ship hardcoded auth/delivery bypass codes from the existing demo configuration.

## 10. Motion and accessibility

Proposed motion tokens: 140ms feedback, 200ms content/sheet entrance, a maximum 5px content entrance or 14px sheet travel in the browser preview. No endlessly moving map pins, animated fake progress, flickering alerts, bouncing logo or countdown pressure.

Use native navigation transitions and compatible existing animation facilities. Native text, inputs, safe areas, keyboard handling and focus must not be replaced with a WebView containing the HTML. Preserve OS reduced-motion preferences; keep success/error information available without animation. React Native exposes relevant accessibility state through AccessibilityInfo. [W3]

Use meaningful accessibility labels and state for switches, checkboxes, primary actions, selected tabs and error messages. Confirm sheets need focus management and Escape/back dismissal without mutation. Large text may increase sheet/screen height; retain scroll and expose the sticky action above the keyboard. Never hide code errors or the cash amount under the keyboard.

## 11. Exact implementation handoff

Read `CODEX_IMPLEMENTATION_PROMPT.md`, `API_CONTRACT_MAP.md` and the actual HTML/CSS/screens before work. Reuse the existing `apps/rider-app`; do not modify the merchant web shell or another repository. Keep its existing session/Google/push integration unless a scoped implementation task authorizes changes.

Use `EXPO_PUBLIC_API_URL=https://api.sirfbazar.com/api` through the current app's config/client. Vite's `VITE_API_URL` is for the merchant web app, not this native app. Verify actual configuration rather than silently defaulting to another environment. Do not include `/api` twice or copy server secrets into client configuration.

Implement proper native components with the same visual tokens and assets, not an iframe, image-only UI or raw HTML renderer. Map reference screens to the current React Navigation routes. Keep isolated fake data only in local stories/tests; normal app screens use authenticated API reads and confirmed writes. Do not rewrite backend functions just to fit the mock.

All live mutations need authorized test records and scope. This design request does not authorize SMS, uploads, accepting real merchant work, live delivery completion, changes to production data or deployment.

## 12. Visual and integration acceptance

Compare the actual app and reference under the same logical dimensions, matched content, font availability and theme. No claim of pixel-perfect native parity based only on a browser screenshot. Account for real safe areas/system bars and document deliberate platform differences.

Required native checks: Android back, keyboard/code input, screen-reader labels, text scaling, reduced motion, Light/Dark/System, sheet behavior, network retry, uncertain completion, account change, background/foreground transitions, location denial and expired tokens. Required integration: assignment visible only to correct rider; real pickup/arrival/delivered results retained after refetch/relaunch; merchant sees corresponding progress; no duplicate collection; support errors not called successes.

`QA_REPORT.md` records only local browser preview checks actually run. It does not certify the native implementation, production security, uninterrupted tracking or API uptime.

## 13. Release questions found in the source

These are source-review observations, not claims that the deployed service is exploitable or that a whole security audit was performed:

1. **Delivery-code exposure:** detail removes `deliveryOtp`, but assigned-orders returns full order fields without the same explicit exclusion. Verify server serialization; an allowlisted rider response must omit the code. UI hiding is not sufficient remediation. [C3]
2. **Mock completion configuration:** delivery completion contains a mock-mode bypass and defaults to mock when the configuration is absent in the inspected function. Verify production settings and remove test bypasses from live use through an authorized backend task. [C3]
3. **Account status enforcement:** setOnline and rider lookup do not themselves visibly require approved/active in the inspected excerpts. UI disabling is not a substitute for checking actual guards/server policy. [C3]
4. **Payment/atomicity:** completion applies status, then COD payment changes, then rider reset and notifications. Verify partial failures and concurrent completion; a timeout may follow saved state. Cash acknowledgement is not an idempotency guarantee. [C3]
5. **Native report success:** the existing screen's action helper catches failures, while its report handler subsequently alerts success unconditionally. Production adaptation must report only confirmed success. [C5]
6. **Foreground tracking scope:** verify polling lifecycle and active-status gating, especially after delivery, screen changes, maps hand-off and revoked consent. [C5, W1]
7. **Source/deployment parity:** read-only review of default-branch source does not prove the live server uses exactly this build. Resolve differences before binding or claiming verified flows.

Do not expose, test or reproduce bypass values to verify the live service. Record backend changes separately; do not silently alter production during design integration.

## 14. Source register

S1 — Owner's uploaded 29 September 2026 NestJS startup log, included in `reference/API_STARTUP_LOG.txt`; rider routes original lines 92–107, auth lines 43–49, merchant assignment line 85, support lines 220–225.

C1 — `apps/rider-app/package.json`, default-branch file read for existing technologies.
C2 — `apps/api/src/rider/rider.controller.ts`, DTOs and routes.
C3 — `apps/api/src/rider/rider.service.ts`, sections 1–115 and 112–395, signup/profile/location/history and delivery operations.
C4 — `apps/rider-app/screens/LoginScreen.tsx`, existing auth/route behavior.
C5 — `apps/rider-app/screens/DeliveryScreen.tsx`, existing device/route/confirmation behavior.
C6 — `apps/api/src/rider/rider-apply.controller.ts` and `apps/api/src/auth/auth.dto.ts`, application/login request definitions.
C7 — repository search excerpt in `apps/api/src/orders/orders.service.ts`: `deliveryOtp: generateNumericCode(4)`. This generator was located through an excerpt, not a fresh full audit of order placement.

Source paths and hashes are captured in `SOURCE_MANIFEST.json`; distinguish whole-file reads, selected ranges and search excerpts.

External technical references, checked 29 September 2026; implementation guidance, not added backend capabilities:

- W1: Expo Location, matching existing SDK family: https://docs.expo.dev/versions/v54.0.0/sdk/location/
- W2: Google Maps URL hand-offs: https://developers.google.com/maps/documentation/urls/get-started
- W3: React Native accessibility state: https://reactnative.dev/docs/accessibilityinfo

These sources do not establish that native maps, background location or every API operation is already production-ready.
