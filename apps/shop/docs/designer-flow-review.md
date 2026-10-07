# Merchant v2 design — final implementation handoff

The seven authenticated merchant views and their shared v2 shell are now implemented in `sirfbazar-shop`. The locked `SirfBazar_Codex_Exact_Design` pack remains unchanged: `reference/merchant_dashboard.html`, `extracted/reference-exact.css`, `extracted/reference-script.READ_ONLY.js`, and `reference/screens/` are comparison material only. The React frontend retains real API calls and authentication against the inspected local **Nest merchant API** in `sirfbazar-api`; it does not use the reference's fixtures, scenario switches, diagnostic labels, or preview-only copy as production data.

## Implemented view map

| Reference view | React route and implemented composition |
| --- | --- |
| Overview (`overview()`, reference script lines 90–97) | `/` → `src/pages/Dashboard.tsx`: v2 heading, four metrics, four-stage pipeline, order/rider panels, merchandise chart and stock panel. API-backed totals and empty/error states remain in place. |
| Orders (`orderPage()`, line 103) | `/orders` → `src/pages/Orders.tsx`: v2 heading, seven status tabs, search, order table and footer. Order detail uses the shared drawer while existing status and assignment API actions remain connected. |
| Products (`productPage()`, line 104) | `/products` → `src/pages/Products.tsx`: v2 heading, listing/low-stock/paused mini-stats, three tabs, seven-column inventory table and editor/catalog flows. Search and product mutations remain API-backed. |
| Riders (`riderPage()`, lines 105–116) | `/riders` → `src/pages/Riders.tsx`: v2 heading, mini-stats, All/Active/Requests tabs and rider card grid. Approval, activation, add and detail actions still call the merchant API. |
| Team (`teamPage()`, line 117) | `/team` → `src/pages/Team.tsx`: route and v2 team view now exist. Staff list, permissions and account creation use the inspected merchant endpoints; no invitation email is promised. |
| Finance (`financePage()`, lines 123–129) | `/earnings` → `src/pages/Earnings.tsx`: visible Finance heading, four metrics, chart/definition columns, settlement history and read-only details drawer. Current merchant earnings and settlement responses supply the values. |
| Settings (`settingsPage()`, line 130) | `/profile` → `src/pages/Profile.tsx`: v2 details/appearance and storefront-control grid. Light/Dark/System preferences, separate open/online actions, profile edit form and map picker are retained. Approval status remains backend-owned. |

`src/App.tsx` now exposes all seven routes with the reference navigation labels, brand assets, breadcrumb/topbar, theme choices, and responsive drawer navigation. It loads `public/merchant-v2.css` for authenticated operations only, keeping sign-in, signup and recovery styling separate. Shared drawer primitives, icon paths, badges/tables/toasts and theme persistence live in `src/components/` and `src/components/ThemeStudio.tsx`.

## Remaining parity gaps

1. **Overlay choreography is not yet identical.** Orders still puts rider selection and its confirmation inside the order detail flow instead of the reference's separate assignment drawer and centered confirmation. Rider reject/deactivate uses browser `confirm()`, and shop open/online actions submit directly rather than through the reference centered confirmation. Team's add form is a styled role-dialog rather than the shared native-dialog primitive. Existing API safeguards should be preserved if these are refactored.
2. **Some page-level geometry differs.** Products keeps search in the heading and uses its existing row controls/editor forms rather than every reference control/field layout. Team uses a card grid where the source has a staff table. The Finance chart is based on returned daily data but uses a different SVG geometry than the reference; its period control currently presents the supported 30-day range. Do not fabricate unsupported import, time-series or settlement actions to fill visual space.
3. **Legacy hidden markup remains** in `src/pages/Earnings.tsx` and `src/pages/Profile.tsx` after the v2 conversion. It is not visible, but should be removed in a cleanup pass to avoid duplicate inactive controls and simplify future accessibility audits.
4. **Visual and interaction acceptance is outstanding.** Source-code inspection and the supplied overview/narrow screenshots guided the conversion, but authenticated side-by-side screenshots at the `VISUAL_TARGETS.json` viewports, keyboard/focus testing of all drawers and forms, and a full light/dark/narrow pass have not yet been recorded. Treat pixel parity as unverified until those checks pass.

The v2 CSS defines the intended breakpoints (≥1600, ≤1200, ≤1050, ≤800, ≤480), desktop sidebar widths, 75px/66px topbar, two-column narrow metrics and pipeline, internally scrolling tables, and reduced-motion behavior. Preserve these while resolving the remaining gaps. The reference pack stays read-only throughout.
