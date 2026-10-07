# SirfBazar Rider — exact native implementation contract

**Handoff version:** 1.0, prepared 1 October 2026. **Visual baseline:** Rider App Design v1, unchanged.
**Audience:** Codex working in the owner's existing native rider application.

This document makes the supplied visual reference an implementation target. It is not a new visual proposal, source audit, native app, deployment or authorization to test against real customer deliveries.

## 1. Required result

The existing native rider application should reproduce the HTML's app-controlled design: the same sections, information hierarchy, dimensions, spacing, typography, original assets, color pairs, interactions and state variants. The main operating routes use the existing real API.

A working result is **not** an HTML WebView, an iframe, an image placed over native controls, a screenshots-only gallery, a new Expo scaffold, a generic delivery template or a color-only reskin.

“Exact” means measurable visual fidelity at matched logical sizes with narrowly documented native differences. It does not justify faking GPS, forcing a phone to display the browser's status bar, disabling accessibility, concealing unsupported backend behavior or declaring untested work pixel-perfect.

### Authority

| Concern | Authority |
|---|---|
| Selected app appearance | Untouched `reference-v1/SirfBazar_Rider_Design.html`, its CSS and SVG assets; original screenshots and screen index identify the expected states. |
| Functional intent | `reference-v1/SIRFBAZAR_RIDER_APP_DESIGN.md` and current owner instructions. |
| Actual API semantics | Current authorized controller/DTO/service/deployed contract inspection. `reference-v1/API_CONTRACT_MAP.md` is the recorded source-review baseline. |
| Repository architecture | The existing app, current lockfile and repository instructions. |
| New implementation process | This document, complete Codex prompt, visual acceptance matrix and top-level helpers. |

Do not let an approximate number in prose override a specific rendered source value. Inspect the actual selector, inline styles and applicable media rules. Record genuine source conflicts instead of silently choosing a new composition. Do not reuse merchant-dashboard or customer-website styles as the rider layout.

## 2. Workspace and change boundaries

Previously inspected native workspace: `apps/rider-app`. Backend source: `apps/api` in `CryptoSodi/SirfBazar`. Re-locate the real paths without creating duplicates. Keep separate repositories/checkouts separate if that is the current setup; communicate through HTTP.

Before editing, inspect git status, package/lockfile, app configuration, navigation, current theme, auth/session client, Google sign-in, push registration, location effect lifecycle and assets. Preserve uncommitted changes. Use installed React Native, Expo and React Navigation conventions instead of forcing a new router or SDK.

Do not edit merchant, customer, admin or POS applications to implement this rider design. Backend fixes, migrations, seeds, deployments and app-store release remain separately authorized tasks.

The original package's build tools are historical sources; do not execute them to regenerate or change the visual target. The top-level helpers write only to separate output directories.

## 3. Reference contents and read checklist

Open the interactive HTML and visit every entry in `SCREENS.json`, in both themes. Review the full scroll area and action sheets, not just the initial screenshots. Read the whole CSS and the relevant scene function; inline markup styles also influence layout.

`reference-v1/SCREENSHOTS.json` contains capture dimensions, theme and screen keys. The screenshot sequence is not the same as the R01–R26 IDs. `screens/36-design-studio.png` is a desktop review interface, **not a rider app screen**.

The original source contains 26 screen/state compositions, 36 screenshots, original SVGs/PNG derivatives, 34 interface icon fragments, browser preview code, theme tokens, API mappings and historical QA evidence. These have been copied from the uploaded archive, not regenerated as a new design.

## 4. Layout locks and native translation

### Reference dimensions

- Main reference viewport: **390 × 844 CSS logical pixels**, with a capture scale of 2.
- Main phone PNGs: **780 × 1688 physical pixels**. Never use these dimensions directly as native layout units.
- Additional required native checks: 360 × 800 and 412 × 915 logical units, actual supported devices and larger text.
- Native height/safe-area budget varies by device. Keep the same app-controlled spacing after the inset; content can scroll. Do not stretch the whole screen to force a screenshot match.

The primary full-screen capture activates `body.capture`. At a 390px viewport, the mobile CSS is also active; for example, `.content`'s effective top padding is **10**, even though the base rule says 12. The reference helper records computed values to remove guesswork.

### Key original CSS values

| Element | Source value / treatment | Native rule |
|---|---|---|
| Simulated status bar | 28 high | Replace with actual OS/system inset. Do not add a fake clock plus the real bar. |
| App header | 68 high; horizontal padding 20 | App-controlled header with actual top safe area handled separately. |
| Scroll content | flex area; padding 10 top at mobile, 20 sides, 22 bottom | Scrollable native content with the correct inset/keyboard budget. |
| Main heading | 28, line-height 1.18, letter spacing -1, weight 750 in CSS | Match metrics and actual available native weight; report unavailable weights, do not synthesize a different font silently. |
| Base text | 14 CSS body default; component overrides | Use explicit native Text styles; parent View does not provide CSS text inheritance. |
| Standard card | radius 20, padding 18, 1-unit border | Same geometry and token pair. |
| Featured delivery card | radius 22, padding 20 | Preserve internal route stops, divider and next-action hierarchy. |
| Main button | min-height 54, radius 14, padding 14 × 16 | Stretch/wrap appropriately at larger text sizes. |
| Featured-card button | min-height 50, radius 12, white fill, dark-green text | Keep this special variant, not generic action-green. |
| Form input | min-height 54, radius 12, padding 14, text 16 | Explicit native text/padding, correct keyboard and editable states. |
| Bottom navigation | 74 high in reference; 4 destinations | Exact visual design plus real bottom inset once, not twice. |
| Detail action dock | padding 12 top, 20 sides, 18 bottom | Replace tabs on detail; accessible above keyboard and actual bottom inset. |
| Sheet | 26 top corners, padding 9/22/25, maximum reference height 88% | Use a native modal/sheet with the same app-owned content; support scrolling/keyboard. |
| Sheet handle | 34 × 4 | Same geometry unless actual platform chrome owns the handle; record differences. |
| Default icon | 22 × 22, stroke 1.7, viewBox 0 0 24 24 | Use exact paths and preserve local size overrides. |
| Icon button | 44 × 44, radius 14 | The hit area may expand without changing the visual glyph. |
| Toggle artwork | track 46 × 28, knob 22, 3 inset | Use matching custom native visuals with switch semantics if stock OS styling cannot match. |

These values are extracted from the reference, not a new framework design system. Rules not shown here still apply from the original CSS.

### Translation responsibilities

- Translate CSS flex/grid into explicit native layout, including direction, gaps, alignment, shrink and minimum sizes. Do not assume native defaults equal browser defaults.
- Translate text cascade into explicit font family, size, weight, line height, color and letter spacing. Verify Android font padding/baseline intentionally, not by arbitrarily shrinking text.
- Use exact SVG geometry or original high-resolution transparent logo assets. PNG dimensions do not establish display size; honor aspect ratio.
- Standard HTML form controls, checkbox visuals and browser focus are not native components. Reproduce the visible design with native semantics, labels and hit targets.
- Use installed/native shadow support compatible with the current version; do not upgrade the SDK merely to match a subtle shadow.
- Preserve scrolling and the separate fixed header/tab/action regions. Do not absolutely position all content to one screenshot.
- Convert whitespace/route connector details, current-state labels and line breaks deliberately. Dynamic merchant names/addresses must wrap rather than overlap or disappear.

Technical references for generic native styling/dimensions are in `IMPLEMENTATION_REFERENCES.md`. They are supplementary; they do not change the supplied layout or API scope.

## 5. Brand and full theme contract

Use `reference-v1/theme-tokens.ts` and actual CSS tokens. Preserve the supplied basket/wordmark, unchanged geometry, with RIDER as a separate label. Use the supplied single-line outlined slogan asset for:

**بازار وہی۔ طریقہ نیا۔**

No new leaf, shopfront identity, SB monogram, delivery mascot, substitute font-drawn wordmark or dominant accent.

| Token | Light | Dark |
|---|---|---|
| brand | #009966 | #009966 |
| action | #007A52 | #007A52 |
| bg | #F7F8F5 | #101614 |
| surface | #FFFFFF | #19221E |
| surface2 | #F0F4F0 | #233027 |
| ink | #071F18 | #F0F6F1 |
| muted | #52695D | #B0C2B7 |
| accent | #007A52 | #73DEAD |
| hero | #07563E | #134D39 |

All other semantic colors, borders and focus values must also match. Native System mode follows OS changes only while selected. Persist a validated light/dark/system choice, with a safe no-storage fallback, following existing app conventions. Appearance storage is not authority for authentication or delivery state.

Theme switching must not remount the navigation tree or reset codes, form checks, notes, screen selection, scroll, filters or requests. Apply themes to safe areas, inputs, icons, notices, sheets, toasts, errors, loading and disabled states. Dark mode is not an inversion filter.

## 6. Screen coverage and route design

Use `SCREEN_PARITY_MATRIX.md` as the completion checklist. These are **states/compositions**, not 26 mandatory separate native route files. A shared delivery view can render assigned/pickup/navigation/doorstep, while cash/code and confirmations can use routes or sheets consistent with existing navigation.

Top-level tabs: **Deliveries · History · Help · Profile**. Detail replaces bottom tabs with the next-action dock and back/help header. Preserve actual native back behavior and return to the initiating screen without changing order status.

Core screen fidelity includes hero route stops, merchant name, current order badge, payment instruction, lower assignment cards, item summaries, confirmations, contact actions, payment variations, appearance choices, onboarding/error text and all below-fold content. Do not deliver only a polished R01 home.

## 7. Live backend context

```dotenv
EXPO_PUBLIC_API_URL=https://api.sirfbazar.com/api
```

Use the current native configuration/client; this URL is public configuration. Do not add tokens, passwords, Google secrets or database settings to an Expo public variable. Preserve existing auth/refresh/session conventions unless a separately scoped change is required.

Backend is the existing NestJS/Prisma `apps/api`, not GroceryServer. The reference's contract map was based on inspected source and an uploaded startup log. This handoff has not freshly audited the checkout or called production. Codex must verify source/deployment parity and actual response envelopes for each integration.

### Core rider actions (client paths omit the already-configured `/api`)

| Operation | Method + relative path | Recorded contract boundary |
|---|---|---|
| Rider profile | GET `/rider/profile` | Linked merchant and rider details; no invented self-edit endpoint. |
| Assigned orders | GET `/rider/orders/assigned` | Rider-owned active records, no open jobs feed or accept-job action. |
| Order details | GET `/rider/orders/:id` | Current assigned/authorized order and snapshots; never display deliveryOtp. |
| Set presence | POST `/rider/online`, `/rider/offline` | Follow existing empty-body convention; not activation or cancellation. |
| Arrive at shop | POST `/rider/orders/:id/arrived-shop` | Optional verified coordinates; allowed from RIDER_ASSIGNED. |
| Pick up | POST `/rider/orders/:id/picked-up` | Optional coordinates; allowed from assigned or arrived-shop; main result ON_THE_WAY. |
| Arrive at customer | POST `/rider/orders/:id/arrived-customer` | Optional coordinates; from ON_THE_WAY. |
| Complete delivery | POST `/rider/orders/:id/delivered` | `{ otp, photoUrl?, note? }`; from ON_THE_WAY or arrived-customer in reviewed code. |
| Report delivery issue | POST `/rider/orders/:id/report-issue` | `{ description }`; does not cancel/complete delivery. |
| History | GET `/rider/orders/history` | Reviewed cap 50; nonactive orders, not all-time statistics. |
| Location | POST `/rider/location` | Actual `{ latitude, longitude, speed?, heading?, orderId? }`; no fake GPS. |

Each action must use real authenticated requests, correct IDs and the actual allowed source state. Opening a screen, drawing a check or selecting an offline scenario never counts as a real state transition. The merchant assignment route is context only; a rider must not call merchant/admin/customer operations.

### Auth and shop application

Retain phone OTP and native Google flows, with the rider context and the current session response. Verify auth/send-otp, auth/verify-otp, auth/google-login, auth/me, auth/refresh-token and logout contracts. Do not inherit merchant password/CNIC screens, fixed OTP banners, mock Google credentials or admin login.

An unlinked user searches `/rider/shops?q=` and applies through `/rider/apply` with the verified `merchantId`, `fullName`, `phoneNumber` and supported optional vehicle/image fields. The inspected flow creates a pending/inactive membership. Show the chosen shop and approval state. Existing linked riders skip application. Never self-approve, duplicate signup on retry or turn a general Google cancellation into fallback registration.

Native Google-provider controlled screens are platform surfaces; retain the designed in-app button/container and actual provider flow, not a fake imitation.

### Cash and delivery-code correctness

Payment method alone does not prove payment state. Show collect-cash only where the verified COD state requires it; verified PAID means no cash. Already-collected COD, failed, unknown and inconsistent states need an accurate explanation and shop/support contact, not a second collection or fabricated settlement.

The customer's delivery code is separate from the rider's login code. The recorded order-generator excerpt uses four digits; the delivery DTO does not itself establish that length. Recheck the deployed generator. Use one accessible field with the reference digit treatment; do not request login-SMS autofill for a customer's handover code. Never prefill a code from a returned order field.

Parcel/cash acknowledgements are **local UX safeguards**, not new API properties. Completion may have multiple backend side effects. If the request times out, refresh saved status before deciding whether to retry; do not automatically submit again or display an unsupported fixed resolution. Do not clear customer/payment context until the result is understood.

### Help, notifications and profile

Order issue category choices become meaningful text in `{ description }` unless a verified DTO adds fields. General support and notifications use the separately mapped shared routes and authorized account scope. Their preview sheets are not implemented servers. Keep the same sheet design but replace example/payload-preview copy with real request feedback.

Rider profile is read-only unless an actual rider self-edit contract exists. No merchant endpoint impersonation. History uses actual source order/status/time/amount with the existing cap; no fake pagination, earnings or lifetime totals.

## 8. Native behavior without a redesign

- Safe areas: use actual OS insets once. Remove the fake status bar from production. Align comparison app content relative to native safe-area start.
- Keyboard: code/phone/note/application forms remain scrollable, and primary actions/errors remain visible. Android Back first dismisses the keyboard where native behavior requires it; no accidental mutation on navigation.
- Maps: the source schematic is fictional. Production uses the same-sized practical destination region with honest address/native navigation, or an existing configured real map. No fake live route, moving rider or invented ETA.
- Contact: prefer the verified delivery-address contact; fall back only to authorized customer/shop fields. Native dialer opens only after user action, never automated calling.
- Location: request permission in context, track only the intended authorized active-delivery lifecycle, expose permission/network failures and clean up watchers. Online does not imply permission or background tracking.
- App backgrounding/maps hand-off: reconcile state on return. Verify real-device background support before claiming continuous tracking; foreground polling alone does not prove it.
- Alerts: use the existing notification registration and native provider configuration. No imitation OS dialog, invented unread counts or success before real confirmation.
- Reduced motion/accessibility: preserve the source content and hierarchy with native labels, switch/checkbox states, focus return and larger text. Do not force a fixed height that cuts off the cash amount, address or error.

## 9. Test data, failures and safety

Normal application routes use the live client. Local visual fixtures must be isolated in tests/development-only visual harnesses, excluded from production data paths and screenshots of real users. Do not build a public login bypass or silently use sample data after an API error.

Keep successful empty, loading, stale network data, API failure, session expiry, forbidden assignment, inactive rider and completion uncertainty distinct. Old private data must disappear on invalid session/account change or reassignment; any offline address caching needs explicit retention/scope rules.

Implement mutation handlers, but do not exercise live OTP, membership, presence, location, pickup/completion, tickets or notification-read mutations without approved test accounts/records and scope. Never probe the recorded mock bypass. Production database work and backend edits remain outside this request.

The original reference lists release concerns: possible assigned-order delivery-code exposure, mock-mode verification settings, approval/activation enforcement and multi-step completion effects. Preserve these as questions for a backend task. UI hiding alone is not a fix and the old source observations are not proof of the live deployment's current state.

## 10. Execution phases — implement all, with progress tracking

| Phase | Deliverable | Exit evidence |
|---|---|---|
| 0: Inspect and lock | Actual workspace/dependency/config notes; original-file verification; screen/API matrix. | Paths and checked contracts recorded; no duplicate scaffold. |
| 1: Native visual foundation | Shared tokens, exact brand/icons, text/button/card/input/tab/dock/sheet primitives, themes. | Matched Home light/dark and an open sheet on an actual native target when available. |
| 2: Delivery work | R01–R08 and R20–R26, native state views and pending/error handling. | Assigned → pickup → arrival → completion test harness and all recovery states. |
| 3: Supporting app | History, Help/report, Profile, Appearance, permissions, sheet flows. | R09–R14 and supported overlays in both themes. |
| 4: Access/application | Existing phone/Google and linked/unlinked/pending/inactive flows. | R15–R19, errors and interruption recovery; no fake account behavior. |
| 5: Real API wiring | Real session/profile/list/detail/actions/history/support/application integrations. | Verified source contracts; authorized reads/test mutations separately reported. |
| 6: Visual and native QA | All 26 state compositions in both themes, System, device sizes and keyboard/text/lifecycle tests. | Native screenshots, measurements/overlays, fixed discrepancies and honest remaining blockers. |

Integrate APIs incrementally; phase order does not require creating a second mock architecture first. Continue independent work when one credential, native tool or contract is missing. Do not claim that blocked checks passed, and do not stop after only Phase 1/Home because an unrelated flow needs access.

## 11. Required reports and acceptance

Create project-local reports using `templates/`:

- `screen-status.md`: every R state plus sheets, actual component/route, light/dark/large-text status and evidence.
- `api-status.md`: registered → source-contract checked → native handler wired → authenticated read tested → authorized mutation/refetch/relaunch verified.
- `visual-parity-report.md`: devices/logical size/pixel scale, font conditions, source/native captures, differences, corrections and limits.
- `design-deviations.md`: only narrow OS-owned/real-data/security adaptations, with exact reason and affected reference state. No unapproved new visual direction.

Run available type checks, compatible native build checks and component/integration tests. Browser preview QA is **historical reference evidence**, not evidence for the implemented native app. Do not mark old 25/25 checks as newly run.

The key end-to-end test uses approved records: a merchant assigns an order → only its rider sees it → pickup/arrival → correct handover code/payment instruction → confirmed completion → rider relaunch and merchant refetch agree. Do not request merchant credentials in the rider app or create assignments through a rider session.

Only report exact visual parity after measuring the actual implementation under declared conditions. Native font rasterization and genuine OS surfaces require explicit comparison boundaries, not a blanket “close enough” or “100% exact” claim.

## 12. Evidence boundary of this new handoff

This document was assembled from the supplied rider v1 HTML, CSS, screenshots, design/API/QA documents and source-register notes. The reference remains unchanged. New helper code, native icon conversion, coverage matrix and comparison process are handoff additions, not features already implemented in the app.

No current native checkout was modified, no new backend/source audit was performed, no packages were installed into the user's app, and no live login, GPS, order or message operation was tested while preparing this handoff. See `PACK_QA.md` for local file/tool checks actually performed.
