# Work modification research — 8 October 2026

Run `20261008T155332Z`, research stage. This report preserves the eight saved request numbers. Source inspection only: no implementation, dependency installation, backend execution, database writes, commits, push or deployment. Verification stage is `null`; proposed checks below are not claimed as executed.

## Scope, evidence and recommendation

Inspected the seven clients (Next.js customer web; Vite merchant, admin and POS; Expo customer, merchant and rider), relevant shared patterns, and notification/authentication/merchant API code. Read `AGENTS.md`, the generated researcher instructions, `docs/architecture.md`, `docs/api-contract.md`, `docs/backend-conventions.md`, and the private backlog/asset manifest. The architecture overview's five-client inventory is older than the current seven-client repository. Current code and API contract take precedence.

The parent agent inspected all six original screenshots and sampled the complete 6.50-second video at two frames per second. Its observations are attributed below; this researcher did not independently replay the pixels. Original evidence remains in `../work-modification/2026-10-08/assets/` relative to the worktree root. No claim about live production configuration or affected account identity has been verified.

Recommendation: fix the confirmed presentation and incomplete-feedback defects locally; use explicit bounded page append for the catalogue; require PM/design review of the customer authentication variants before implementing that flow. Treat notification context as a separate correctness issue, with account-switch regression tests and an API handoff where necessary. Do not hide the notification by deleting history or matching its title.

## 1. Merchant setup map and help dialog

**Confirmed:** `apps/shop/src/auth/SignupFlowPage.tsx:43` considers Google Maps configured only when the browser key exists and, outside development, the map ID exists. The exact “Map preview unavailable” placeholder at line 280 is the unconfigured branch, distinct from a provider load failure. `GooglePinMap.tsx:41` imports map/advanced-marker libraries; line 68 catches load failure using a generic configuration message. Neither establishes which deployed setting is missing. Advanced markers require a map ID; do not remove that guard to make a blank map look enabled. [Google advanced-marker migration](https://developers.google.com/maps/documentation/javascript/advanced-markers/migration).

The help dialog at `SignupFlowPage.tsx:303` uses `information-dialog` and `dialog-heading`, but no stylesheet in `apps/shop` defines either selector. It also lacks an accessible title association. This supports the parent's screenshot observation of an unstyled overlay at the upper left. Native `showModal()` already supplies modal behavior; preserve it, add scoped theme styles, viewport bounds/scrolling, `aria-labelledby`, and verify Escape/focus return. [HTML dialog behavior](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog).

| Option | Benefit | Cost / constraint |
| --- | --- | --- |
| Repair Google configuration and keep current Google picker | Smallest provider change; preserves drag/click integration | Requires evidence from deployed build configuration and actual provider error; this local task cannot establish or change production billing/referrer settings. [Google errors](https://developers.google.com/maps/documentation/javascript/error-messages) |
| Reuse existing `ShopMapPicker` when Google is unavailable **(recommended local fallback)** | Existing Leaflet map, explicit center confirmation, manual coordinates and device location can stay; no new library | Current picker uses public OSM tiles; retain attribution and comply with caching/usage rules, and do not treat public tiles as a guaranteed commercial service. [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/) |
| Keep coordinates/device location alone | Already implemented; remains available during provider outage | Does not satisfy the requested visual map; useful only as recovery |

Target: `apps/shop/src/components/ShopMapPicker.tsx:35` and `:81` already supply the map and native dialog. It reports module-load failure but does not explicitly report tile-load errors; cover that if reused. Never display key values. Check blank/map-ready/tile-failed states, denied GPS, inaccurate GPS, coordinate validation, 320px/200% zoom, keyboard pan/confirm, and focus return.

## 2. Availability switch

**Confirmed:** `apps/shop/src/pages/Dashboard.tsx:88` is already a one-click toggle button, visually disguised by a downward chevron; it is not a real dropdown. `toggleOnline` at line 71 prevents ordinary repeat clicks with a busy state and refetches after POST. It does not currently expose switch semantics or gate the button by `STORE` permission. `apps/api/src/merchant/merchant.service.ts:188` resolves merchant context and enforces `StaffPermission.STORE`, returning the saved `isOnline` value. It does not itself implement a new approval/opening-hour rule; preserve the API contract and distinguish online status from open status.

Recommendation: native button with `role="switch"`, `aria-checked`, a stable label such as “Shop availability”, separate visible “Online”/“Offline” state, and saving feedback. Gate by returned owner/permissions, lock concurrent requests synchronously, update from the successful response, reconcile through the existing refresh, and keep the saved state on failure. A stable accessible label and Space activation follow the [WAI switch pattern](https://www.w3.org/WAI/ARIA/apg/patterns/switch/). A checkbox switch is also valid but adds styling work; the existing button is the smaller change.

Check owner, authorized staff, unauthorized staff, submitted/suspended shop behavior returned by the API, rapid activation, 403/network failure, and online/open disagreement. Do not describe online as a guarantee that customers can order.

## 3. Old rider approval notification in a new merchant workspace

**Confirmed API behavior:** `apps/api/src/notifications/notifications.controller.ts:84` delegates using authenticated `user.userId`; `notifications.service.ts:77` filters persisted history by `userId`, ordered newest first, capped at 100. Reads/read-all also filter user ID. There is no role/workspace filter. `apps/api/src/merchant/merchant-people.service.ts:134` sends the exact rider-approval wording to `rider.userId` with type `SYSTEM` and no `referenceId`. A person with rider history who later opens a merchant workspace can therefore receive their own old rider notification. This is a plausible explanation, not proof of the affected user's history or absence of a production leak.

**Existing protection:** `apps/shop/src/lib/memoryCache.ts:5` scopes entries to merchant ID or user ID; `lib/api.ts:72` clears memory on changed account/shop, and `clearSession` clears it on logout. Calling this an entirely unscoped notification cache would be incorrect.

**Remaining risk:** `NotificationBell.tsx:41` has no request-generation/session guard, and its fetch/socket lifecycle does not subscribe to `sb:session` or browser storage changes. A late old request can call `setItems` and `writeMemory` after an identity change; `writeMemory` calculates the scope at write time. The scope also lacks user and role when merchant ID is present. These are source-supported race risks, not a reproduced disclosure.

| Option | Trade-off | Recommendation |
| --- | --- | --- |
| Account-only inbox, clearly labeled | Preserves all history but does not meet the requested merchant workspace relevance | Insufficient alone |
| Identity-safe frontend lifecycle + server context-aware delivery/list/read policy | Addresses display races and relevant history; server policy must cover websocket and mark-read behavior as well as list | Preferred complete solution; coordinate backend work with the other laptop |
| Filter by title or hide old timestamps | Easy but brittle, locale-dependent, and can suppress legitimate messages without establishing ownership | Reject |

Immediate local targets: capture `userId + app role + merchant context` at request start, ignore stale completions, clear visible state/reconnect on session change, and partition notification cache by that identity. Backend handoff: new notifications need meaningful audience/reference metadata using existing schema-compatible fields if feasible; ambiguous historical `SYSTEM` entries cannot be reliably classified from their current payload. Do not claim the frontend alone fixes the endpoint. Obtain sanitized account/notification/merchant IDs only if diagnosing the live record; no production mutation is required.

Checks: account A→B while A request is pending; two users in one merchant; shared user with rider and merchant sessions; logout/relogin; socket reconnection; unread counts and mark-all-read consistency; foreign-ID read attempts; future/invalid timestamps. Screenshot age alone is not evidence of wrong timestamp calculation.

## 4. Customer category hierarchy and styling

Parent's video evidence: merchant `/products`, expanded “Milk, Eggs & Bread”, green child selection, center breadcrumb/title/search/results, and a right selection tray. Clicking Yogurt & Raita→Cream→Eggs changes results (17→20→1). It also briefly displays old results below a new heading before the skeleton: preserve the layout idea, not that transient mismatch.

**Confirmed:** merchant hierarchy is `apps/shop/src/pages/Products.tsx:39`; customer uses native disclosure/links in `apps/web/components/CategoryFilters.tsx:5`. Customer search at `apps/web/app/search/page.tsx:71` already separates sidebar and mobile filters but lacks the reference's clear heading/row treatment. Preserve `categoryPath`, slug/ID resolution and native navigable links. `filterHref` at line 63 reconstructs only q/type/category; sort is local state, so URL persistence is incomplete today.

Recommendation: adapt the merchant parent/child spacing, active-child treatment, breadcrumb and central category title to customer links. Keep product offers and purchase controls; omit selection checkboxes, price/stock editors and the right bulk-add tray. Retain a narrow-screen disclosure with visible selected path. Keep q/category/type/sort URL state and back/forward behavior coherent. On request changes, ensure the heading and result set belong to the same request generation; expose loading/result count as a polite status. [WAI status guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

Check nested categories, parent “all” selection, direct deep links, unknown category recovery, rapid switching, shop-only results and 320px layout.

## 5. Homepage dark mode and controlled sliders

**Confirmed:** `apps/web/app/globals.css:107` sets `.sb-home-shop` background to `#fff`; line 115 switches text tokens to `#f0f6f1` and `#b0c2b7`; lines 235/239 apply those tokens without overriding the white card. Computed from the declared opaque sRGB pairs, contrast is **1.10:1** for the heading and **1.87:1** for secondary text, below 4.5:1 for these text sizes. These are source-pair calculations, not a browser pixel measurement. Switching to the existing `--sb-surface` dark value `#19221e` yields 14.86:1 and 8.73:1 respectively; verify actual rendered pairs in both themes.

`apps/web/app/page.tsx:56` renders essentials before categories at line 62. Categories have bare horizontal overflow (`globals.css:101`), no previous/next controls. Current essentials use a six-product grid and shops use a responsive grid: the screenshot's horizontal appearance must not be assumed to match every current rail.

Recommendation: move category content above essentials and give each requested rail named Previous/Next controls, touch scrolling, end-state disabling and a clear content cue. A CSS scroll-snap rail plus small controls reuses the existing layout with no package; a carousel library offers more behavior but adds dependency/configuration overhead unnecessary for this bounded interaction. Keep focus on the activated control and disable smooth scrolling for reduced motion; no autoplay. [WAI carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/). Check zero/one/many items, resize after loading, keyboard/touch, light/dark and reduced motion. Controls should not initiate extra API pages unless deliberately designed.

## 6. Complete action-feedback toast migration across seven clients

**Confirmed:** all seven clients already have Toast/ToastHost implementations. Web hosts exist in `apps/web/components/Toast.tsx:29`, shop/admin/POS `src/components/Toast.tsx:29`; native hosts exist in each mobile `components/Toast.tsx:28`. Errors persist until dismissed; success times out, web hover/focus pauses dismissal, and native screen-reader mode preserves success. Reuse these patterns instead of introducing a second toast library.

| Client | Confirmed inspection / remaining target |
| --- | --- |
| Customer web | `components/GoogleAccountLink.tsx:36` still renders link-result action feedback inline. LoginSheet uses ToastMessage; its basket-merge recovery at line 127 must remain persistent. |
| Merchant web | `pages/IPos.tsx:338` is the exact inline dismissible action-error banner in the screenshot; line 372 also emits the same error within payment, risking duplicate notification on mount. `components/GoogleAccountLink.tsx:36` remains inline. |
| Admin web | Common host is mounted; `components/GoogleAccountLink.tsx:36` remains inline. `pages/Orders.tsx:29` is a load failure with Retry, not a transient action message. |
| Standalone POS | Common host is mounted; `components/GoogleAccountLink.tsx:36` remains inline. Preserve saved uncertain sale recovery in `src/lib/sale-recovery.ts`. |
| Customer mobile | Root and LoginSheet/native-modal hosts present (`App.tsx:276`, `components/LoginSheet.tsx:191`); inspect action paths with device runtime before calling migration complete. |
| Merchant mobile | Root and Products/Riders/Catalog/OrderDetail modal hosts present; preserve field validation and permission/read-state UI. |
| Rider mobile | Root host and `components/RiderUI.tsx:121` modal host present; device delivery/recovery interaction remains unverified. |

The web host chooses the last DOM-matched dialog before `document.fullscreenElement` (`shop/components/Toast.tsx:37`). That is not necessarily the active visible top-layer container. Verify fullscreen iPOS with a payment/help dialog and a stale/hidden dialog elsewhere. Fullscreen/top-layer behavior cannot be fixed by z-index alone. [MDN Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API/Guide).

Recommendation: emit action outcomes once at their source, leave a stable live-region host, scope queued messages to session where they can contain private context, and resolve the active modal/fullscreen container. Do not steal scanner focus. Use polite success announcements and appropriate errors, without turning persistent basket reconciliation, uncertain sale, field errors or retry controls into disappearing messages. [WAI status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html). Full seven-client runtime completion is not established by source search or message-component counts.

## 7. Merchant catalogue Load more

**Confirmed:** shared catalogue `apps/shop/src/pages/Products.tsx:153` requests a bounded page of 24 then replaces `result`; line 200 renders Previous/Next. Separate `selected` state at line 68 already preserves selected product/price/stock records across page changes. Other pagination blocks exist for shop listings and import-related views: do not indiscriminately rewrite every page control.

Recommendation: append one explicit next page, dedupe by `productId`, keep successful prior pages visible on append failure, retry the same failed page, and prevent concurrent appends with a synchronous in-flight guard. Reset only the visible page chain on q/category change; keep the independent selection and pending bulk request. Reject responses belonging to a previous filter generation. Refresh after a mutation must reconcile already-listed status without silently unlocking an uncertain bulk-add request.

Compared with infinite scroll, an explicit button gives predictable user-triggered request volume and reachable footer/focus behavior. Compared with replacement pagination it keeps context but grows DOM/memory usage; retain page size 24 and measure practical long-session limits. Do not prefetch 109 pages or promise fewer calls purely from changing the control. Announce “24 more products loaded” with a stable status and show loaded count/end state. [WAI status guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

Check double clicks, duplicate/overlapping pages, empty last page, failed page retry, category change in flight, selecting/editing on earlier pages, and bulk-result reconciliation. **Baseline overlap:** this worktree has duplicate `ToastMessage` imports at lines 535 and 748; the parent reports an outside-worktree consolidation already fixes them. Resolve only the necessary overlap when implementing; do not copy unrelated dirty changes.

## 8. Customer authentication design variants — review before implementation

**Current journey:** guest browsing/cart continues until checkout; profile also opens the same `LoginSheet`. Phone OTP and Google both call `afterLogin` (`apps/web/lib/api.ts:208`), which stores the customer session, merges the guest basket once, then requires caller review. `CartMergeUncertainError` retains the guest token and presents explicit basket recovery. Checkout line 307 returns to review and never places an order automatically. Account linking is a separate authenticated `/auth/google-link` action, not a substitute for signing in or an account-merge tool.

**Confirmed UX issues:** `LoginSheet.tsx:21` defaults to “Login to place your order”; profile says sign in while the same phone proof can create an account. It asks an optional name on the first step, does not explain the combined flow, discards the send-OTP response, and exposes immediate resend without a cooldown. The API (`auth.service.ts:150`) can return unconfirmed submission messaging; frontend must not claim WhatsApp delivery is confirmed. The web focus trap (`LoginSheet.tsx:48`) enumerates only buttons/inputs, excluding terms/privacy links and Google iframe behavior. Native LoginSheet already has cooldown and clearer combined copy; use its behavioral lessons while retaining provider parity.

| Variant | Experience and trade-off | Assessment |
| --- | --- | --- |
| A. One “Sign in or create an account” sheet **recommended** | WhatsApp code and official Google button; explain automatic account access/creation, then code verification and return to profile or checkout review. Keeps existing API and caller contracts. | Lowest change risk; best fit for current shared flow. Keep name optional without an extra required step. |
| B. Separate Sign in / Create account tabs | Familiar labels, but both still call the same OTP/Google identity proof. Without new backend identity semantics, tabs can misleadingly promise distinct operations and add duplicate UI. | Only choose if research establishes a real user benefit; no new account-enumeration endpoint. |
| C. Dedicated authentication page with safe return destination | More space for explanatory copy, errors and recovery; easier narrow-screen layout. Requires secure return-path handling and careful cart/caller-state restoration. | Viable later; more routing/recovery work than this repair requires. |

All variants retain the official Google control/provider behavior. Google recommends the rendered library button, with supported text/theme/size options; a custom imitation can miss platform behavior. [Google button guidance](https://developers.google.com/identity/gsi/web/guides/display-button). Separate choices need explicit keyboard and focus testing; native dialogs can reduce custom modal work, but changing the container still needs Google popup/iframe verification. [HTML dialog guidance](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog).

Recommended states for design review: entry with purpose → sending → code sent or submission unconfirmed → verifying → success with basket review, or persistent merge uncertainty. Include wrong/expired code, cooldown, change phone, Google cancellation/load failure, linked-account conflict, and session expiry. Use response-driven cooldown/expiry information already supplied by the API; never change WhatsApp delivery infrastructure or log proof/tokens. Do not automatically resubmit an order after login. Existing customer OTP and Google return paths, authenticated Google linking, basket merge and order-recovery IDs are invariants.

## Consolidated interface review and verification handoff

This is a source/evidence research review, not post-implementation approval. The required better-interface and accessibility/layout/writing/typography/colors/UI skills informed these recommendations.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Native help dialog, switch candidate, LoginSheet focus selector, toast host, rail markup | Missing dialog title association; incomplete auth focus handling; runtime checks pending |
| Layout | Help CSS search, category hierarchy, homepage order; parent media observations | Missing shared help styles and requested hierarchy/rail work confirmed |
| Writing | Availability state, OTP wording, merge recovery, provider errors | Authentication purpose/delivery wording needs revision; recovery text must remain |
| Typography | Homepage card font declarations and auth labels | No independent font-system defect established; wrapping/zoom not verified |
| Colors | Homepage declared foreground/background pairs | High-severity contrast failure calculated; rendered measurements pending |
| UI | One-click status control, pagination, shared toast lifecycle | Dropdown affordance misleading; explicit slider/append states needed |

| Severity | Domain | Location | Before → proposed after | Why |
| --- | --- | --- | --- | --- |
| HIGH | Colors | `apps/web/app/globals.css:107` | White card/light dark-theme text → semantic surface/text pair | Confirmed declared contrast fails readability threshold |
| HIGH | Accessibility | `apps/web/components/LoginSheet.tsx:48` | Trap excludes links and Google control boundary → complete tested modal focus model | Keyboard route can bypass interactive content or escape expected ordering |
| MEDIUM | Layout | `apps/shop/src/auth/SignupFlowPage.tsx:303` | Unstyled unnamed help dialog → bounded themed native dialog with associated heading | Screenshot/layout and source agree; narrow-screen clipping still needs runtime measurement |
| MEDIUM | Writing/UI | `apps/shop/src/pages/Dashboard.tsx:88` | Down-chevron toggle → stable labeled switch with saved state | Current affordance misrepresents interaction |
| MEDIUM | UI | `apps/shop/src/pages/IPos.tsx:338` | Inline dismissible action error → one toast emission | Confirmed unfinished requested migration; persistent recovery remains separate |

Narrow commands, **after local dependencies are available**, with explicit worktree/app working directories and all shell execution through `rtk proxy`:

| Working directory | Command | Purpose |
| --- | --- | --- |
| `work-modification-code/apps/shop` | `rtk proxy npm run test:catalog` | Existing category-path checks; add append/race tests for changed behavior |
| same | `rtk proxy npm run test:ipos` | Local mocked counter recovery/integration tests; inspected integration test stubs fetch |
| same | `rtk proxy npm run test:bulk` | Bulk selection/recovery preservation |
| same | `rtk proxy npx --no-install tsc --noEmit` | Shop typecheck without backend build |
| `work-modification-code/apps/web` | `rtk proxy node --test test/feedback.test.cjs test/checkout-recovery.test.cjs` | Web feedback/category helper and checkout recovery regressions |
| same | `rtk proxy npx --no-install tsc --noEmit` | Web typecheck |
| `work-modification-code/apps/customer-app` | `rtk proxy node --test test/feedback.test.cjs test/checkout-draft.test.cjs` | Native feedback parity and preserved checkout draft |
| `work-modification-code/apps/pos` | `rtk proxy node --test test/sale-recovery.test.cjs` | Uncertain cash-sale recovery |

Fresh worktree lacks node_modules, so the TypeScript-dependent tests cannot currently be assumed runnable without an explicit dependency source. No test command above was executed by this researcher. The parent agent reports a baseline run from the worktree root: `node --test apps/web/test/feedback.test.cjs apps/web/test/checkout-recovery.test.cjs` passed **9/9**, borrowing TypeScript through process-local `NODE_PATH=../icon-refresh/apps/web/node_modules`. This protects pending immutable checkout identity, account ownership, friendly-error parity across four web clients, and nested category paths. It is not a clean-install or post-change result. The parent also reports `git diff --check` passed through escalated read-only Git.

Use only local/mock browser fixtures for frontend verification; no live OTP, sale/order creation, provider mutation, API server/build, schema migration or live business writes. Additional focused tests must cover notification session races, append request ordering, auth/modal focus, fullscreen toast visibility, and preserved Google/WhatsApp choices. Validate the seven clients at their actual supported surfaces; web screenshots do not establish installed mobile behavior.

**Verdict: Block release pending the high findings and runtime verification.** This does not block PM/design review or the already-authorized local implementation after the strategy gate. Live map configuration and the historical notification identity remain explicitly unverified.
