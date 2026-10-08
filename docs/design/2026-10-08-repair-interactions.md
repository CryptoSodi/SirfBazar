# Repair interactions — 8 October 2026

ATeam run `20261008T155332Z`, design handoff. Preserve original request numbering. Scope: merchant setup, availability, catalogue and shared feedback; customer browsing and authentication. Design only; no application changes or runtime approval. Read [research](../research/2026-10-08-work-modification.md), [strategy](../strategies/2026-10-08-work-modification.md), root AGENTS/RTK, existing React screens and `apps/shop/docs/designer-flow-review.md`. The approved merchant v2 pack stays read-only.

## Shared visual and interaction rules

Reuse the current React/native controls, theme tokens, ReferenceIcon set and approved `/brand/` assets. Inspected `sirfbazar-horizontal-no-slogan.svg`; do not redraw it. Customer uses Plus Jakarta Sans with Arial fallback. Keep the current 10–16px control/card radii and semantic surface/text combinations. Use 16px input text on narrow screens, readable wrapping and unitless 1.5 body line-height. Do not truncate errors, selected paths or primary actions. Separate form groups by at least twice their internal gap.

Customer token pairs from `apps/web/app/globals.css:114`: light surface `#fff`, ink `#071f18`, secondary `#52665c`, support `#f0f4ef`, mint `#eaf7f0`; dark surface `#19221e`, ink `#f0f6f1`, secondary `#b0c2b7`, support `#223027`, mint `#183d2c`. Action text is `#007a52` light / `#73dead` dark; filled primary remains `#007a52` with white text. Focus `#4762cc` light / `#a7baff` dark. Apply tokens by role, not arbitrary hardcoded white surfaces. Merchant signup retains its own signup tokens; authenticated merchant retains v2 tokens.

All pointer actions need native keyboard equivalents. Give controls visible focus, a minimum 44px touch target, stable names and explicit state text. Modal content must fit `calc(100dvh - 32px)`, scroll internally, contain overscroll, associate heading/description and restore focus. Test 320px, 200% zoom and long names; actions remain in normal flow or accessible sticky chrome with safe-area padding. No autoplay. Reduced motion removes smooth scrolling and nonessential transitions. Theme changes are immediate.

## 1. Merchant setup map and help

Keep Google picker when configuration and loading succeed; reuse existing `ShopMapPicker` for unavailable Google. Do not loosen map-ID guards or display config/key values. Map region → concise instruction → device-location/map-picker actions → latitude/longitude fields. On desktop retain paired coordinates; stack before labels or controls clip. Preserve current address and coordinates while map providers change.

| State | Visible behavior / recovery |
| --- | --- |
| No location | “Choose the shop entrance on the map, use device location, or enter coordinates.” Do not imply a selected shop entrance. |
| Map loading | Reserve map footprint; “Loading map…”; coordinate fields remain usable. |
| Ready | Click/drag selects with Google; Leaflet center selection needs explicit “Use this location”. Keep attribution visible. Keyboard users can pan the supported map or enter coordinates and confirm. |
| Map module/tile failure | “Map could not load. Retry the map or enter coordinates.” Keep device-location recovery. Retain existing selected values. |
| Finding device location | Disable only that action; “Finding location…”; no duplicate request. |
| Denied / failed GPS | “Location access was denied. Allow access in your browser or choose the entrance on the map.” Failure text states manual recovery. |
| Device location found | “Device location selected. Check that the pin is at the shop entrance.” Device position is not proof of entrance accuracy. |
| Invalid coordinates | Errors beside each field, `aria-invalid`/description; focus first invalid field on submit. |

Help stays a native `showModal()` dialog: heading “Choose the shop entrance”, readable guidance, visible “Close”, associated title and themed backdrop. Escape closes; focus returns to help trigger. Public OSM tiles are a fallback, not a guarantee of production availability.

## 2. Shop availability

Replace the dropdown chevron with a thumb/track switch and visible Online/Offline text. Button role `switch`, stable accessible name “Shop availability”, `aria-checked` reflects saved server state. Tab then Space/Enter activates once. Respect owner/STORE permission; unauthorized staff see status and explanation “You need shop settings permission to change availability.” Availability remains separate from open hours/approval.

Saving: synchronously lock requests, leave last saved state visible, show adjacent “Saving…”, `aria-busy`; do not announce the intended state as saved. Success: reflect returned `isOnline`, announce “Shop availability saved: Online/Offline.” Failure: retain saved state and one persistent action toast “Availability could not be saved. Try again.” An ambiguous transport failure requires refreshing saved status before another change; do not falsely claim rollback. Narrow: state label and switch stay together; ancillary text wraps below.

## 3. Notification context — dependency

Architect owns audience and identity rules. Design must not conceal history by title or timestamp. Clear visible inbox during context change; expose loading/error state with Retry. Do not declare rider-to-merchant relevance or server history fixed by visual changes. Source-supported lifecycle guards are separate from pending server policy.

## 4. Customer category hierarchy

Adapt merchant `Products.tsx:39` parent/child indentation and active row, retaining customer native links. Desktop: category sidebar, breadcrumb, category heading, search/sort/results. Parent disclosure and parent navigation are separate controls; disclosure says “Expand/Collapse [category]”. Expand ancestors of selected child. Active link has mint surface, action text, stronger weight and `aria-current`; color alone is insufficient. Parent selection means all products in that category. Do not copy merchant selection tray, price/stock editing or bulk checkboxes.

Narrow: visible “Categories” disclosure in document flow plus selected path. It must not overlay purchase controls. Breadcrumbs wrap, not truncate. Preserve q/category/type/sort in navigation and Back/Forward. New filter generation shows its matching loading region; never show old product rows under a new category heading. Stable polite status announces result count after resolution. Empty: “No products found in [category]. Try another category or clear filters.” Unknown category: explain and offer “Browse all categories”; load failure has persistent Retry.

## 5. Homepage themes and controlled rails

Order: existing hero → Categories → Everyday essentials → shops/remaining existing sections. Reuse current card components; theme the shop card surface with `--sb-surface`. Each requested rail has heading, native Previous/Next buttons named for its rail, touch scrolling, scroll-snap and an edge cue. Activating scrolls approximately one visible group, not a network page. Keep focus on the button; scrolling/touch/resize update disabled start/end states. Zero items shows truthful empty/load failure and recovery; one item has no navigation controls; many show controls. Every item is reachable by keyboard without drag. Reduced motion uses immediate scroll. No autoplay, invented offers or fabricated prices/counts.

## 6. Action feedback across seven clients

Reuse existing ToastHost in customer/merchant/admin/POS web and all three native clients. Emit once at the action source; remove duplicate inline transient outcome. Toast sits above active modal/fullscreen container, not merely at a high z-index. No focus movement, including scanner workflows. Success: polite stable live region, existing 5-second expiry paused on hover/focus; native screen-reader mode retains it. Error/action: remains until dismissed with a 44px “Dismiss notification” target. Theme uses existing toast surface and explicit “Done” / “Please check” labels; do not encode error by hue alone.

Keep field validation adjacent to fields, load failures beside Retry, uncertain sale/order recovery beside its recovery action, and basket merge uncertainty persistent. Do not convert these into disappearing feedback. Clear session-private queue on identity changes. At narrow widths keep toast within 16px margins and safe area, wrap long text, allow internal scrolling and keep dismissal reachable. Test fullscreen iPOS with active payment/help dialog and an unrelated hidden dialog; native modal hosts require device testing.

## 7. Merchant catalogue Load more

Replace only shared-catalogue Previous/Next. Footer shows “Showing [unique loaded] of [returned total] products” where total exists, with one neutral “Load more products” button. One activation appends one 24-product page; no prefetch loop. Deduplicate by productId and ignore obsolete filter generations. Keep earlier rows, selected products, price/stock drafts, tray and uncertain bulk request unchanged during append.

Loading: disable append with “Loading products…” and preserve button footprint/focus. Success: announce “[unique added] more products loaded”; do not move focus into rows. End: “All available products loaded”, no dead action; if removing the focused append button, move focus to a stable nearby summary. Failure: earlier rows remain; persistent “More products could not load” beside “Retry loading products”, retry same page. A failed initial fetch has its own Retry and no misleading loaded summary. Query/category change resets visible chain and shows matching skeleton; independent selection persists. Narrow: tray uses existing responsive behavior, footer controls wrap and never cover price/stock fields.

## 8. Customer authentication — review gate

Open [standalone variants](customer-auth-variants.html). A is recommended: combined “Sign in or create an account” sheet, existing WhatsApp OTP and official Google control. B compares tabs but explicitly states both use the same account verification; C compares dedicated page with safe return route. These are local inert design examples, not operational forms. Select a variant before auth implementation, as explicitly requested. No backend feature, identity-enumeration endpoint, password, provider, or account merge is introduced.

Entry: “Verify your phone or use Google to access an existing account or create one.” Checkout purpose: “Continue to review your basket before placing an order.” Profile purpose: “Continue to your account.” Optional name remains optional. Phone supports paste and tel autocomplete; OTP is a single 6-digit field with numeric keyboard/one-time-code autocomplete, not six focus stops. Terms/privacy remain reachable real links in production.

Sending → response-driven code state → verifying → `afterLogin` once → caller success. Use API submission wording: never claim WhatsApp delivery confirmed when status is unconfirmed. Resend cooldown/expiry comes from response; no invented fixed duration. Show “Change phone number”, actionable wrong/expired-code errors and cooldown remaining with tabular numerals. Google uses official rendered library button; design placeholder deliberately has no Google logo or fake interactive provider. Unavailable/cancel/failure offers phone recovery. Google linking is separate authenticated behavior; conflict does not silently merge accounts. Session expiry opens account proof while preserving guest shopping.

Merge uncertainty: persistent “Your account is ready, but we could not confirm your guest basket was saved. Do not place the order yet. Check for missing or duplicate items.” Primary “Check basket”. Do not clear guest token, auto-retry merge, auto-place order or toast away recovery. Complete focus handling includes links, buttons, inputs and provider iframe boundary; move focus to code/invalid field/merge heading as applicable and restore trigger on close. Native dialog preferred only after provider popup/iframe testing; page variant needs validated local return destination and recovery-state restoration.

## Interface review and verification boundary

| Domain | Evidence / applied rule | Status |
| --- | --- | --- |
| Accessibility | LoginSheet focus selector, signup dialog, ToastHost, switch/rail/append specification | Source inspected; keyboard/provider and assistive technology runtime not verified |
| Layout | Merchant hierarchy/approved handoff, signup region, customer tokens and variants | Responsive behavior specified; 320px/zoom runtime not verified |
| Writing | OTP/account semantics, device-position caveat, merge recovery, action feedback | Reviewed against current source and research |
| Typography | Existing font stack, wrapping, numeric timers, 16px narrow inputs | Declared in prototype; actual brand font not embedded, Arial fallback used offline |
| Colors | Existing light/dark semantic token pairs | Reused; browser rendered contrast not verified |
| UI polish | Current card/control radii, restrained motion, single primary per auth state | Applied to design; app states not executed |

| Severity | Domain | Source location | Before → after | Impact |
| --- | --- | --- | --- | --- |
| HIGH | Accessibility | `apps/web/components/LoginSheet.tsx:48` | Buttons/inputs-only trap → complete modal focus model incl. links/provider | Keyboard access must cover every control |
| HIGH | Colors | `apps/web/app/globals.css:107` | Hardcoded white shop card with dark-theme light text → semantic surface | Research confirms declared pair failure; actual rendered pair needs verification |
| MEDIUM | Layout | `apps/shop/src/auth/SignupFlowPage.tsx:303` | Unstyled help dialog → bounded themed native dialog/title | Readable help and reachable dismissal |
| MEDIUM | Writing | `apps/web/components/LoginSheet.tsx:21` | Login-only wording / confirmed sent wording → combined account semantics / response-driven status | Avoid false account or delivery expectations |

Verification: source and approved asset inspection completed through RTK. `rtk proxy node -e` parsed the prototype inline script with `vm.Script` and checked for external URLs, requests and external script/CSS dependencies: passed. CSP blocks network connections and form submission. Prototype static validation is separate from application runtime; browser rendering/focus and actual font metrics remain not verified. No live OTP, provider requests, checkout, map or app server run. Runtime stage is null. **Block release pending high findings and keyboard/light-dark/narrow/runtime acceptance; design handoff is ready for review.**
