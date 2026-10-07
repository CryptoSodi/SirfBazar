# SirfBazar Rider — design system

Use with `SIRFBAZAR_RIDER_APP_DESIGN.md` and the reference HTML. These are native-mobile target designs; HTML demonstrates composition and behavior, not a WebView architecture.

## Brand

Approved original basket + SirfBazar wordmark. RIDER is a separate role label. No leaf/shopfront/logo reinterpretations. Slogan: **بازار وہی۔ طریقہ نیا۔** as one horizontal RTL unit using provided artwork. Reversed dark treatment preserves vector geometry. Fonts are not bundled.

## Character and hierarchy

Quiet, practical, familiar. The next physical task is more prominent than summary metrics. Own merchant and own assigned order always visible. Large readable address/payment text, restrained semantic badges, primary action within thumb reach. No job-marketplace visuals or invented earnings. Mobile composition is not a scaled-down dashboard.

## Tokens

Complete source: `rider-design.css` and `theme-tokens.ts`.

- Identity #009966; primary action #007A52; hover #006442; white action labels.
- Light: canvas #F7F8F5, surface #FFFFFF, secondary #F0F4F0, ink #071F18, muted #52695D, accent text #007A52.
- Dark: canvas #101614, surface #19221E, secondary #233027, ink #F0F6F1, muted #B0C2B7, accent text #73DEAD.
- Featured assignment surface: light #07563E, dark #134D39, white heading and #C5EADB supporting text.
- Semantic warning, error and info use their own foreground/background pairs, not green for all statuses.

## Layout

390×844 logical reference, 20 padding, 8/12/16/20/24 spacing rhythm. Main body scrolls above the 54-high primary action. 44+ icon targets, 14 radius buttons, 20 cards, 22 featured card, 26 top sheet corners. Native safe areas replace the fake browser status bar; keyboard must not cover code errors or confirmation.

Plus Jakarta Sans chosen family; Inter then Arial for browser fallbacks. Local screenshot rendering is documented in QA. Main heading 28/1.18, section 21, card 16, body 14–16, supporting 12–13. Respect native font scaling; no text-size hacks to mimic screenshots.

## Navigation and components

Bottom tabs: Deliveries, History, Help, Profile. Delivery details show header/back/help plus action dock. Shared components: BrandSignature, RiderPresence, FeaturedAssignment, DeliveryStop, PaymentInstruction, DeliveryProgress, PackedOrderCheck, HandoverCodeInput, PrimaryActionDock, ConfirmSheet, HistoryRecord, SupportForm, AppearanceSelector, PermissionExplainer, ErrorState.

## Theme and motion

Light / Dark / System; persist appearance only, respond to OS changes in System, preserve task/form/scroll. Themes apply everywhere including native status/navigation bars, sheets, keyboard style where supported, errors, maps, controls and focus. 140ms feedback, 200ms entrances. No looping progress or animated GPS. Honor reduced motion without removing information.

## Data honesty

Only own-assigned orders. Cash is not rider income or merchant acknowledgement. Non-COD is not necessarily paid. Route drawing is a labeled illustration until replaced with verified map content or a nongeographic summary. Preview notices/review controls are not production UI. Live errors must never trigger demo data fallback.
