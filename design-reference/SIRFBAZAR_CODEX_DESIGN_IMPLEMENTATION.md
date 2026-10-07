# SirfBazar — Design Implementation Contract for Codex

**Document version:** 1.0  
**Date:** 27 September 2026  
**Visual baseline:** SirfBazar Design Studio v5, supplied HTML  
**Task:** Apply this design to the existing SirfBazar applications, not to a new throwaway prototype.  
**Scope:** Customer mobile app, customer website, merchant workspace, merchant-owned rider app, platform admin.

> **Instruction to Codex:** Inspect the existing repository and the supplied HTML, then implement the design in the current apps. Preserve working business logic, routes, integrations and authorization. Use reusable, theme-aware components and interactive charts where appropriate. Do not stop after writing a plan, do not replace the apps with the HTML, and do not silently redesign the approved identity.

---

## 0. Start here

### Minimum inputs

The owner will supply:

1. This Markdown file.
2. `SirfBazar_Design_Studio_v5.html`, or an explicitly identified newer/themed export of that HTML.
3. Access to the existing project/repositories in the coding workspace.

The HTML contains the visual reference, embedded branding assets, five review interfaces, theme controls and fictional demonstration data. The original ZIP and `BRANDING.md` are helpful but are **not required to begin** when the standalone HTML is available.

Suggested placement, not an assertion about the existing project structure:

```text
<existing-project>/
  SIRFBAZAR_CODEX_DESIGN_IMPLEMENTATION.md
  design-reference/
    SirfBazar_Design_Studio_v5.html
    BRANDING.md                         # Optional supporting guide
    assets/                             # Optional supplied SVG exports
```

Do not move or reorganize the application just to match this example. Record the actual input paths before implementation. Read applicable repository instructions, including existing `AGENTS.md` files, before editing.

### Required outcome

Implement the supplied visual system in the **existing application screens**. This includes branded shells, navigation, content hierarchy, tables, forms, cards, charts, dialogs, responsive behavior and the Theme Studio review tools. Connect existing features to their existing services. Record missing capabilities instead of replacing real services with demo logic.

The HTML is not the product. An iframe, WebView wrapper, screenshot, embedded dashboard image, copied monolithic script or disconnected alternative app is not completion.

### Authority labels used in this document

- **OWNER REQUIREMENT:** Explicit choices from the project conversation.
- **V5 REFERENCE:** Behavior or appearance inspected in the delivered v5 HTML/package.
- **IMPLEMENTATION REQUIREMENT:** A production-integration or quality rule added by this handoff. It must not be misrepresented as a feature already implemented in the HTML.
- **UNRESOLVED:** A product, backend or architecture decision that the sources do not establish.

The source register in section 17 identifies the inspected files and separates technical documentation from project decisions.

---

## 1. What is fixed, and what can change

### 1.1 Visual authority

Use this order for visual decisions:

1. The owner's latest explicit instruction or explicitly approved themed export.
2. The supplied v5 HTML rendered at the relevant viewport and state.
3. The selected basket SVG artwork and exact slogan.
4. This document's instructions for componentization, React charts, themes and production integration.
5. Supporting branding documents, where they do not conflict with the later v5 interface refinement.

**Do not treat earlier v1/v2 brand explorations or the older v4 screen styling as the latest reference.** In particular, v5 refines card radii, work surfaces, dashboards and typography hierarchy. Its runtime-generated theme values can override the static CSS at the top of the file.

The HTML controls visual arrangement. Existing server contracts, permissions and approved business rules control real behavior. A fictional click handler in the HTML does not authorize changing those rules.

When the sources conflict, record the conflict, preserve safe existing behavior and continue unaffected work. Ask a focused question only when inspection cannot resolve a consequential decision.

### 1.2 Locked identity

| Item | Requirement |
|---|---|
| Name | `SirfBazar`, one word with capital S and B |
| Mark | The selected simple grocery basket, handle and three vertical openings |
| Default primary brand colour | `#009966` |
| Default action colour | `#007A52` |
| Brand ink | `#071F18`; do not confuse logo colour with every runtime UI text token |
| Exact slogan | `بازار وہی۔ طریقہ نیا۔` |
| Slogan layout | One continuous horizontal right-to-left line |
| Latin interface typeface | Plus Jakarta Sans |
| Live Urdu text treatment | Noto Sans Arabic; use supplied outlined slogan artwork for the actual logo lockup |

Use the provided logo paths. Do not substitute a library basket, a cart, a leaf, a shopfront, a grocery crate, an SB monogram or a hanging-sign mark. Do not type the wordmark in an approximate font. No new logo generation is part of this task. [P2]

### 1.3 Preserve current application architecture

**No production repository was inspected when this Markdown was written.** The frameworks, routing, packages, API contracts, state libraries and deployment structure must be discovered, not assumed.

Preserve:

- Existing app boundaries, routing/deep links, build tools and package manager.
- Working authentication, OTP/Google integrations, API clients, sessions and permission checks.
- Inventory, order, payment, cancellation, delivery and settlement business logic.
- Existing database schema, background jobs, maps and notification integrations.
- Uncommitted user work and unrelated application features.

Do not scaffold a new Vite/Next.js app over an existing project, migrate every app to React, replace a native app with a WebView, introduce a new database or create a monorepo solely for this design task.

Do not upgrade framework majors, overwrite a lockfile wholesale, run destructive migrations, reset databases, deploy, or send real notifications/payments as part of visual verification.

---

## 2. Mandatory discovery before implementation

### 2.1 Audit the repository

Inspect the workspace and identify the actual locations of all five interfaces. Some may be separate repositories; some may share one frontend. Do not assume all five are present.

Record:

| Audit item | Required finding |
|---|---|
| Application | Product name, repository/package and entry point |
| Runtime | Web/native/hybrid, framework, language and installed versions |
| UI foundation | Existing components, styles, theme provider, icon and font handling |
| Routes | Real route names and corresponding reference views |
| Data | Existing services/hooks, response types, loading/error handling |
| Security | Roles, merchant membership, route guards, authorized actions |
| Quality | Available build, lint, typecheck, test and screenshot commands |
| Baseline | Existing failures, console issues and uncommitted changes before editing |

Inspect package manifests and lockfiles rather than picking dependencies from memory. Do not expose environment secrets in the audit or screenshots.

### 2.2 Inspect the HTML as a running interface

Use an isolated local review surface. Do not make the reference available through an authenticated production admin route.

Inspect at minimum:

```text
#admin/dashboard
#admin/orders
#merchant/dashboard
#merchant/orders
#merchant/pos
#customer/home
#customer/basket
#customer/checkout
#website/home
#website/shop
#rider/home
#rider/pickup
#rider/proof
```

Then inspect every remaining reference view listed in Appendix A before implementing its counterpart. Open representative drawers, forms, validation errors and empty states. Change the theme, sidebar, density and radii to understand the behavior, not just the first screenshot.

Capture reference images at matching desktop/mobile widths. Measure computed styles after scripts initialize; do not read only the first `:root` declaration.

### 2.3 Create a traceable route map

Create a small implementation record in the project's existing documentation location. Suggested filename: `DESIGN_IMPLEMENTATION_STATUS.md`.

Use this schema:

```text
Reference route | Actual app/route | Component/file | Data source |
Scope classification | Implementation status | Screenshot/test | Blocker
```

Scope classifications:

- **Existing:** Restyle and reconnect the existing feature.
- **Existing equivalent:** Map the reference to the current differently named feature.
- **UI missing, backend available:** Implement within existing architecture and permissions.
- **Backend/product decision missing:** Build an isolated review state only when useful; do not fake a live feature.
- **Concept:** Preserve the proposed status and keep out of live navigation unless separately approved.
- **Repository unavailable:** Document which product is missing; do not fabricate implementation.

Record all 68 reference views. A route count is a coverage checklist, not evidence that 68 production features exist.

### 2.4 Proceed after the audit

Write a brief implementation sequence and start the first safe slice. Do not ask the owner to repeat decisions already settled here. Do not stop at an audit when the repository permits implementation. Finish independent work even when one integration is blocked.

---

## 3. Component strategy and stack compatibility

**OWNER REQUIREMENT:** Use React-based charts and modern reusable UI components where compatible with the current apps. The approved direction is React + TypeScript, shadcn/ui, Tailwind CSS, Recharts, TanStack Table and Motion, with Theme Studio retained.

### 3.1 Compatibility rules

| Existing app | Implementation approach |
|---|---|
| React web frontend | Reuse its framework/router and introduce or reuse the agreed component/chart stack selectively |
| React web app with an established equivalent design system | First adapt existing primitives; avoid two competing component systems and redundant libraries |
| React Native or other native app | Implement native equivalents using the existing framework; share tokens/meaning, not browser DOM components |
| Non-React web app | Preserve its architecture; use compatible equivalents or document the smallest proposed React integration boundary; no unapproved migration |
| Missing frontend repository | Document the missing input and proceed with available apps |

React Native has its own native components; web chart and DOM primitives are not automatically native components. [R6]

### 3.2 Library responsibilities

| Tool | Responsibility and limits |
|---|---|
| React / TypeScript | Reusable presentation components and typed integration boundaries; do not migrate the whole repository to TypeScript just for this task |
| shadcn/ui | Compatible primitives for dialogs, sheets, tabs, menus and forms; style to match SirfBazar, not the default gallery |
| Tailwind CSS | Use the project's installed setup if present; do not introduce a second CSS reset or incompatible major configuration |
| Recharts + shadcn chart primitives | Actual responsive analytical charts, theme-aware tooltips and legends |
| TanStack Table | Table state and logic while retaining custom SirfBazar markup and styling |
| Motion | Restrained motion where helpful; retain the current animation library if equivalent |
| Existing test tools / Playwright when compatible | Interaction and visual regression verification |

shadcn's chart primitives use Recharts and support CSS-variable colour configuration. TanStack Table is headless rather than a fixed visual table theme. Motion supports reduced-motion handling. These are technical capabilities, not reasons to replace existing working dependencies. [R1, R3, R4]

Inspect the installed versions and use matching official documentation. Do not paste incompatible “latest” examples into an older library. Retain the existing shadcn primitive family and configuration; do not mix families just because a current documentation page defaults to a different one.

### 3.3 Suggested reusable boundaries

These names express responsibilities, not mandatory directories:

```text
BrandLogo / BrandSlogan
ThemeProvider / ThemeStudio / ThemePreviewSurface
OperationsShell / MerchantShell / AdminShell
CustomerWebShell / CustomerMobileShell / RiderShell
PageHeader / WorkspaceSwitcher / SidebarGroup
MetricCard / AttentionStrip / StatusBadge
DataTable / TableToolbar / RowActions / Pagination
ChartCard / OrderVolumeChart / DeliveredValueChart / OrderPipeline
MerchantCard / ProductCard / QuantityControl / BasketSummary
OrderTimeline / OrderDetailsDrawer / PickupChecklist
FormField / ConfirmDialog / EmptyState / ErrorState / Skeleton / Toast
```

Reuse existing counterparts. Share visual primitives without sharing privileged data. Do not build one huge component with dozens of role checks, or five unrelated copies of the same button/theme system.

Use the application's existing route and data-fetching patterns. Do not move data access into components merely because the HTML renders from one global object.

---

## 4. Extract and preserve the design assets

### 4.1 Preferred assets

Use the named SVGs when available:

```text
sirfbazar-primary.svg
sirfbazar-horizontal-no-slogan.svg
sirfbazar-stacked.svg
sirfbazar-reverse.svg
sirfbazar-stacked-reverse.svg
sirfbazar-monochrome.svg
sirfbazar-basket.svg
sirfbazar-basket-white.svg
sirfbazar-wordmark.svg
sirfbazar-slogan-urdu.svg
sirfbazar-app-icon-green.svg
sirfbazar-app-icon-white.svg
sirfbazar-app-icon-ink.svg
```

Primary = horizontal logo plus slogan. Compact header = horizontal no-slogan artwork. Reversed variants are for dark backgrounds. Use the existing native asset pipeline for app icons rather than treating a square preview tile as a ready-to-submit platform asset set. [P2]

### 4.2 When only the standalone HTML is supplied

The inspected v5 HTML contains a `const ASSETS` object mapping filenames to base64 SVG data URLs. Extract the named branding entries using a parser or safe JSON decoding. Do not execute arbitrary uploaded script text to obtain assets.

Decode the supplied files, retain their viewBox/path geometry, and place them in the application's existing asset location. Inspect the SVG contents before inlining. Do not inject arbitrary user-provided SVG/HTML with `dangerouslySetInnerHTML`.

Do not crop branding boards or trace the logo from a screenshot. If the expected embedded artwork is missing, document the missing asset rather than inventing one.

### 4.3 Font and image handling

Use Plus Jakarta Sans through the project's approved font-loading strategy. Preserve established licences and loading paths. Do not fabricate local font files, redistribute fonts from the design environment, or introduce a blocking font dependency unnecessarily.

For branding, prefer the outlined Urdu slogan. For live Urdu content, use `lang="ur"`, right-to-left direction and a suitable existing font fallback. Keep `بازار وہی۔ طریقہ نیا۔` in one line without manually reversing characters or replacing Urdu punctuation. On cramped headers, use the compact logo instead of making the slogan unreadable.

The HTML's grocery packages and hero composition are fictional illustrations. Keep them in an isolated review fixture only. Production catalogue cards must use accurate authorized product images from existing data, with meaningful placeholders when images are absent. Theme changes must not recolour product photography.

---

## 5. Design tokens: brand identity versus runtime interface

### 5.1 Source-derived baseline

The v5 Theme Studio derives the runtime palette; its values take precedence over older static prototype tokens. This is important: the supplied logo can retain its brand ink while page text follows the current light/dark palette. [P1, P3]

| Token/role | Original light | Original dark |
|---|---|---|
| Primary accent | `#009966` | `#009966` |
| Action fill | `#007A52` | `#007A52` |
| Canvas | `#F6F7F9` | `#111417` |
| Panel | `#FFFFFF` | `#1A1E22` |
| Secondary panel | `#F0F2F5` | `#242B31` |
| Third surface | `#E8EBEF` | `#35414B` |
| Main UI text | `#172321` | `#EDF1F4` |
| Secondary UI text | `#63716E` | `#AAB5BE` |
| Border | `#E4E8E7` | `#30383E` |

Tint, accent text, hero background and hover colour are generated from the selected accent. Copy/adapt the derivation from the supplied source; do not independently guess new values for each screen.

Radius options in the inspected theme engine:

| Stored value | Label | Control | Card | Feature panel |
|---|---|---:|---:|---:|
| `square` | Precise | 4px | 7px | 12px |
| `soft` | Soft, default | 9px | 14px | 24px |
| `rounded` | Rounded | 13px | 21px | 30px |

### 5.2 Token integration contract

Map the v5 variables into the existing theme system. Retain aliases during an incremental migration instead of replacing all global CSS at once.

Examples of mappings, not a mandate to use these exact internal names:

```css
/* Full CSS colour values, not numeric HSL fragments. */
--background: var(--canvas);
--foreground: var(--text);
--card: var(--panel);
--card-foreground: var(--text);
--popover: var(--panel);
--popover-foreground: var(--text);
--primary: var(--action);
--primary-foreground: var(--on-action);
--muted: var(--panel-2);
--muted-foreground: var(--secondary);
/* --border already exists in v5: do not assign it to itself. */
--input: var(--border);
--ring: var(--focus);
```

**Important naming collision:** Legacy prototype `--muted` means secondary text; shadcn's `--muted` convention is a surface. Resolve this with an explicit namespace/adapter. Do not paste both meanings into the same scope. Similarly, v5 `--accent` is the brand accent, whereas a component library may use an accent token as a subtle interaction surface. Keep `--sb-*` or another project namespace when necessary. [R2]

Verify the installed library expects full colours before using the example. Do not wrap a HEX-valued variable in `hsl(...)`. Do not paste a Tailwind major-version configuration from an unrelated setup.

Include semantic tokens for success, warning, error and information. Do not make every status adopt the selected accent. Keep foreground/background pairs together and check both themes.

### 5.3 Layout and type fidelity

Source-derived desktop anchors include a 246px operations sidebar, 77px app topbar, and approximately 27px vertical / 30px horizontal main padding at the standard desktop breakpoint. The reference narrows the sidebar at smaller desktop widths. Inspect computed values at the actual target size rather than fixing one width everywhere.

The 56px top “Design Studio” bar is **review chrome**, not a production app header. Remove it from the shipped apps and remove its offset from fixed headers/sidebars. Native phone frames, screen-directory panels and demo labels are also review-only.

**Implementation requirement:** Preserve composition while making real controls readable. Some prototype helper labels are unusually small. Do not mechanically ship 8–10px operational instructions merely to match a screenshot. Aim for readable body/form text, touch-friendly primary actions and sensible text scaling; document necessary deviations in the implementation record. Do not use this exception to change the overall design language.

Use consistent spacing, baseline alignment and card anatomy. Preserve the selected screen's proportions and information priority. Avoid new decorative gradients, excessive rounding, unrelated illustrations or a generic dashboard-template appearance.

---

## 6. Theme Studio — implement, do not just imitate

**OWNER REQUIREMENT:** The owner must be able to change colour themes and review the design. Preserve this across the five product previews.

### 6.1 Exact portable configuration

Keep import compatibility with the supplied v5 format:

```ts
export type SirfBazarTheme = {
  version: 1;
  color: string; // Normalized #RRGGBB after validation.
  mode: "light" | "dark" | "system";
  sidebar: "light" | "dark";
  density: "comfortable" | "compact";
  radius: "square" | "soft" | "rounded";
  previewLogo: boolean;
};

export const originalTheme: SirfBazarTheme = {
  version: 1,
  color: "#009966",
  mode: "light",
  sidebar: "light", // v5 means "Match page", not "always light".
  density: "comfortable",
  radius: "soft",
  previewLogo: false,
};
```

Theme schema version `1` is separate from the design release named `v5`.

### 6.2 Controls and presets

| Preset | Accent |
|---|---|
| Original | `#009966` |
| Cobalt | `#2563EB` |
| Iris | `#7C3AED` |
| Teal | `#0D9488` |
| Terracotta | `#D96735` |
| Rose | `#DB3B6D` |
| Amber | `#D89B20` |
| Slate | `#475569` |

Implement colour-picker input, editable HEX with Apply/Enter, light/dark/system appearance, match-page/dark sidebar, comfortable/compact table density, the three radius presets, optional logo-colour preview, and reset. Only Original is the approved baseline branding. [P3]

Theme changes must update buttons, hover/focus states, navigation selection, cards, drawers, menus, tooltips, charts, search fields and promotional surfaces consistently. Portaled overlays must receive the same theme. Product imagery and semantic status meaning must remain intact.

### 6.3 Contrast and chart colours

Retain the selected accent for brand highlights, but derive a suitable action background for white button labels. Original retains `#007A52`. The v5 engine adjusts other accents and computes accent text against its tinted surface. Port the algorithm as a pure tested function instead of building five variants. [P3]

New chart tokens must distinguish data lines, grid, axis labels and tooltip surfaces. Do not use a near-white custom accent as an invisible line on a white panel. Derive an appropriate graphical tone or provide another visible encoding while retaining the owner's selected accent in the theme.

Test text contrast against the actual surface, including dangerous-action buttons in dark mode. A readable status badge does not automatically make its foreground suitable as a solid button fill. WCAG's normal-text contrast reference is 4.5:1, and 3:1 applies to qualifying large text; these are checks, not a claim that the complete app is accessible. [R7]

### 6.4 Persistence and scope

Use one theme controller per application boundary. Keep preferences separate from domain state.

The inspected review key is `sirfbazar.ui-theme.v5`. Reuse it in the review environment or migrate explicitly. Do not import the HTML's `sirfbazar-five-apps-demo-v4` store into production.

- Changing or resetting a theme must not clear a basket, active order, login, filters or unsaved business form.
- Never call `localStorage.clear()` to reset appearance.
- Handle unavailable/corrupt storage; retain an in-memory session and explain it when saving is unavailable.
- System mode must react to OS preference changes. Separate the stored choice `system` from resolved `light`/`dark`.
- For server-rendered web apps, initialize through the existing safe theme mechanism, avoid hydration mismatches and avoid accessing `window` during server rendering.
- Native apps need an equivalent token/preference adapter, not browser APIs.
- The combined review surface can share one theme. Separate origins/apps do not automatically share localStorage; use export/import or an existing approved preference service. Do not introduce a new synchronization backend without scope approval.

### 6.5 Safe import/export

Implement compatible JSON export/import and resolved CSS export for web review.

Validate imports before applying: object only, version `1`, three or six hexadecimal digits with optional `#`, allowed enum values and Boolean `previewLogo`. Normalize HEX; limit imported JSON to 32 KiB; ignore unknown keys. Never interpret imported values as arbitrary CSS, HTML or JavaScript. Invalid input leaves the previous theme unchanged and shows a field-level error. [P3]

Exported CSS represents the currently resolved appearance. A static CSS export of System mode does not by itself implement OS-responsive behavior. Keep the JSON choice available.

Preserve “Save themed HTML” in the **development/design-review experience** where a portable review build is supported. Export a sanitized fixture-only review surface, not the live application's DOM, cookies, customer data, sessions or financial records. Do not serialize production screens to achieve parity with the demo exporter. If the build architecture cannot supply this safely, retain the original standalone HTML review tool and document the limitation; JSON/CSS round-tripping still must work.

### 6.6 Review controls versus production settings

Keep the full Theme Studio and five-role preview switcher in a development/review surface. They are not public customer controls or permission mechanisms. A deployed user must not turn into an admin through a preview tab.

Preserve any existing approved appearance preference in production. A new public arbitrary-brand-colour setting or global admin-brand editor needs separate product approval.

The review panel is nonmodal on wide screens and modal on narrow screens. Preserve focus restoration, Escape, clear labels and keyboard navigation. Retain the T shortcut only where it does not conflict with an existing shortcut, text input or active business dialog. Do not steal typing focus.

Optional logo preview recolours an in-memory display copy only, leaves original files untouched and defaults off. Preserve wordmark and Urdu path geometry.

---

## 7. Implement the five distinct product experiences

### 7.1 Customer mobile app

**Job:** Browse nearby shops, choose groceries, order and follow delivery without forced entry onboarding.

Match the v5 mobile composition: location context, recognizable branding, search, compact promotional message, categories, nearby merchants, product/saved-item discovery and persistent bottom navigation. Do not reuse an operations sidebar or a shrunken desktop dashboard.

Preserve merchant identity on product and basket screens. Show product image, name, pack/unit, price, availability and an unambiguous quantity action. Distinguish unavailable stock from a zero-price item.

Basket and checkout must show merchandise, delivery and other actual existing charges separately, with one clear next action. Preserve the basket on authentication or network failure. Google/OTP belongs near final order placement, not on first app launch. Signing in must not silently submit the order.

Use the existing location and permission flow. Do not claim a precise detected location without permission/confirmation. The prototype's fixed demo area is not a production location service.

Tracking uses the existing event/state stream. Preserve merchant acceptance, preparation, pickup, arrival and completion where supported. No decorative animation may imply a rider is moving or an order is delivered.

Include the eleven mobile reference views and their loading, empty, failed and signed-out states. Account-only actions should use the existing authentication gate rather than exposing private data to anonymous browsing.

For native builds, remove the phone-device frame, handle safe areas and keyboard insets, and preserve existing back/deep-link behavior.

### 7.2 Customer website

Use the same commerce domain as the customer app, not another customer database or account system.

Match the wider v5 composition: search-led header, location/shop context, navigation, asymmetric hero, category discovery, merchant cards and product grid. Desktop basket/checkout can use a readable summary column; mobile web must reflow rather than scale down.

Keep browsing and product pages on their current URLs; preserve existing SEO/metadata/server-rendering behavior where present. Do not force all real routes into the prototype's hash router.

Implement all eleven website counterparts. Share data contracts and low-level components with the customer app only where the runtime makes sense. Desktop and mobile have different layouts, not different prices or ownership rules.

### 7.3 Merchant app / workspace

**Job:** Operate the authorized shop's catalogue, online orders, stock and own riders.

Use the DreamPOS-inspired operational grouping in the reference: Workspace, Inventory, Retail Tools, Sales & Delivery, Growth & Finance and the remaining business/settings sections. Match the actual v5 menu labels when implementing their corresponding routes. Do not add unrelated ERP/HR/payroll modules simply because another retail template contains them.

Dashboard composition:

1. Merchant context and page actions.
2. Four metrics: online orders, delivered item value, orders in progress and low-stock products.
3. An attention strip for actionable queues.
4. Main analytical card plus order-pipeline card.
5. Recent orders and best-selling delivered products.

Replace the static prototype chart implementation with real React chart components where the app is React. Preserve the commercial meaning, not the fixture values. Do not add fake percentage increases.

Order screens need searchable/filterable records, explicit statuses, item details, merchant actions, assigned rider, totals and event history. Use existing state transitions and API permissions.

Product/inventory screens need consistent form sections, accurate pack units and pricing, real validation, image handling, availability controls, stock reasons and relevant expiry/low-stock states. Preserve current inventory rules.

Riders must remain merchant-linked. Merchant views must not reveal other shops' customers, inventory, settlements or staff.

**POS, purchases and suppliers remain Concept extensions.** When the existing project already supports one, restyle its approved implementation. Otherwise keep its review screen/feature flag without exposing fake live transactions. Do not silently create a full retail backend. [P4]

### 7.4 Rider app

**Job:** Complete the rider's assigned merchant deliveries with minimal distraction.

Match the v5 task-led home: merchant association, availability state, next-stop card, assignment cards, route context and bottom navigation. Keep the most important action easy to reach. No platform-wide charts or central-fleet language.

Pickup: authorized assignment, correct shop/order, item checklist and confirmation. Delivery: readable address, appropriate contact/navigation actions, payment instruction and help. Confirmation: use the actual proof/arrival/payment requirements; do not ship the HTML's `1234` code.

Show whether cash should be collected. A prepaid order must not appear as cash due. Cash awaiting merchant handover is not rider income. A handover request and merchant acknowledgement are separate outcomes when supported by the backend.

Keep genuine offline, location-denied and retry states. Do not mark a physical delivery complete solely because an offline button was tapped; use the current sync/status rules and display pending confirmation honestly.

Implement the eight rider views and their native equivalents. Preserve safe areas, accessible touch targets and legible instructions outdoors without introducing unsupported device features.

### 7.5 Platform admin

**Job:** Oversee the marketplace, resolve exceptions and administer authorized platform functions.

Dashboard composition:

1. Workspace context, page heading and actual period/filter controls.
2. Marketplace orders, delivered item value, active merchants and attention count.
3. Actionable attention strip.
4. Order/value analytics and order-pipeline breakdown.
5. Recent orders and merchant activity.

“Delivered item value” is not SirfBazar revenue. Use real definitions, timestamps and permitted scopes. Do not present fixture dates or simulation counts as live operations.

Implement the nineteen mapped modules with permission-aware navigation and row actions. Admin merchant oversight is not the merchant app. Admin should not silently impersonate merchant/rider transitions because the prototype has a cross-role demo journey.

Settlements and COD, commission rules, disputes, permissions and integrations must use their existing backend protections. Do not expose provider secrets, initiate payouts, change commercial rates or bypass approval with front-end state.

Categories and catalogue moderation must follow the application's existing publication rules, including any supported rejection/review states not shown in the prototype.

---

## 8. React graphs and analytics specification

**Implementation requirement:** Convert analytical chart areas into actual data-driven React charts in compatible web apps. Preserve the dashboard's arrangement; do not merely paste a generic chart gallery into it.

### 8.1 Required chart surfaces

| Surface | Presentation | Data/interaction contract |
|---|---|---|
| Admin order volume | Responsive time-series chart | Selected period, real counts, clear unit, exact tooltip value |
| Admin delivered merchandise | Separate measure in the existing chart card | Real delivered merchandise aggregate, not total payments or platform revenue |
| Merchant chart | Same component, merchant scope | Only authorized shop data |
| Order pipeline | Segmented distribution with labeled rows; use a chart only when it adds value | Each state counted once, documented denominator, click-through to matching records |
| Merchant activity / bestsellers | Preserve ranked list or use the existing report's appropriate chart | Approved real aggregation, clear count/unit |
| Reports | Match each reference report's intended measure | No fabricated time series when an endpoint is missing |

The reference's Orders / Item value toggle must change the data, tooltip format and unit, not just the title. Retain the current application's date-range behavior. Where historical data is absent, show a truthful unavailable/empty state rather than pretending a date filter worked.

**Production-correctness adjustment:** The reference pipeline list does not explicitly show every lifecycle state used elsewhere, including arrival. Include all actual backend states or a documented grouping such as “On the way / at destination.” No order may disappear from a distribution because its state was absent in the prototype. This is a correction to data coverage, not permission to redesign the screen.

### 8.2 Chart component contract

- Pass real typed data and explicit loading/error/unavailable state into the chart.
- Use responsive containers with an explicit usable height/min-height; avoid zero-height first render. [R1]
- Use theme tokens for lines/bars, axis labels, grid, legend and tooltip surfaces.
- Keep count and currency scales/formatters separate. Do not compare mixed units on one unlabeled axis.
- Preserve UTC/backend timestamps and display the project's configured timezone. Use Asia/Karachi for Pakistan reporting only when the product/report configuration calls for it; do not hard-code fixture hours.
- Define whether time buckets use placement or completion time. The prototype uses placement-hour buckets; preserve real reporting semantics and label them accurately.
- Distinguish missing data from a genuine zero. Do not interpolate invented history.
- Use zero-baseline bar charts for ordinary magnitude comparisons; make other scale choices clear.
- Give charts a title, period, summary and text/table alternative. Tooltips cannot be the only place essential values exist.
- Support keyboard/touch interaction and reduced motion with the installed library's capabilities. [R1, R4]
- Drill-down changes a real filter or route, and uses the same scope as the plotted data.
- Loading or theme changes must not reset the selected merchant, period or filter.

Implement one chart-card and tooltip language, not individually styled widgets. Do not add animations or large chart dependencies to the customer/rider initial bundle when unused.

### 8.3 Financial display rules

Keep merchandise subtotal, delivery, discounts, taxes, collected total and platform amounts distinct according to real contracts. Reuse the existing monetary representation and formatting; do not invent a new amount scale or rounding model.

The prototype's example commission is not an approved rate. Do not copy it into production configuration or recompute historical booked amounts from a mutable front-end percentage. An online payable, COD receivable and cash held by a rider are different records; use existing ledger definitions.

---

## 9. Tables, forms, overlays and shared states

### 9.1 Operational tables

Use the existing data layer with TanStack Table or the established equivalent. The library should handle behavior without dictating SirfBazar styling. [R3]

Preserve the v5 table composition: page heading/actions, scoped summary where present, search/filter toolbar, clear header, readable rows, status chips, row actions and pagination.

Requirements:

- Stable record IDs, accurate totals, accessible table headers and keyboard-operable controls.
- Real server-side pagination/sort/filter when the API provides them. Do not client-filter one loaded page and label it the full result set.
- Debounced search where appropriate; clear-filter and no-results states; maintain current route query conventions.
- Comfortable/compact density without hidden columns or unreadable controls.
- Right-aligned amounts and consistent dates, IDs, pack units and statuses.
- Row-action menus and destructive confirmation; clicking a checkbox must not also open a detail drawer.
- Selection scope is explicit: page, loaded rows or all matching records. Bulk actions must respect existing authorization.
- Tables scroll inside their container on narrow screens, or use purpose-built cards where appropriate. Keep critical actions discoverable.
- CSV exports reflect their declared scope and permitted data. Protect text cells against spreadsheet-formula injection; do not export hidden personal data just because it is present in the response.

Do not introduce virtualization unnecessarily; use existing large-list patterns and test focus/row selection when virtualization is used.

### 9.2 Forms

Use visible labels, grouped sections, helper/error text and clear required/optional states. Preserve existing schemas and server validation. Do not add new mandatory personal fields to make the form resemble a mockup.

Show inline validation without erasing entries. During save, prevent duplicate submissions and show a pending state. Announce success only after the actual operation succeeds. On errors, show recovery and preserve context.

Warn before dismissing dirty forms where data would be lost. Image/file controls must use existing upload validation and services; a chosen local filename is not proof of a successful upload.

### 9.3 Dialogs, drawers and notifications

Use consistent anatomy: title, short context, content, primary/secondary actions. Preserve focus trap when modal, Escape/cancel behavior, focus restoration and mobile scrolling. Portals must inherit the selected theme.

Toast messages supplement, not replace, persistent order/payment/error information. Never show “Sent,” “Paid,” “Refunded,” “Delivered” or “Approved” from a local animation without the actual service outcome.

### 9.4 Minimum state matrix

Every data screen must cover the relevant states:

```text
Initial loading → content / empty / failed
Refreshing existing content
No search results
Unauthorized / forbidden / expired session
Submitting → success / validation error / service error
Offline or unavailable dependency
Disabled or concept-only capability
```

Use neutral skeletons with layout-stable dimensions. Do not replace failures with empty lists or hide errors under permanent loading spinners.

---

## 10. Data integration and role boundaries

### 10.1 Keep presentation separate from business state

Map backend records to view models using existing hooks/services or small adapters. Keep server state in the current data/cache layer. Do not transplant prototype globals, `state.orders`, simulated sessions or direct localStorage transactions.

Keep filters, open drawers, selected chart measure and theme preferences as presentation state. Do not use client-side hiding as authorization.

Actual mutations must retain the repository's idempotency, server validation, optimistic-update/rollback strategy and audit behavior. Financial or delivery confirmation must not be optimistically declared complete when the backend requires confirmation.

### 10.2 Business facts that the design must preserve

- SirfBazar is the marketplace; participating shops fulfill orders.
- Merchants own/manage their inventory and delivery arrangements, including their riders.
- Customer app and website share the customer domain.
- A merchant sees its authorized shop scope; a rider sees relevant assigned work.
- Admin permissions are granular. A platform overview does not grant every action.
- Browse-before-login is intentional; preserve a low-friction customer entrance.
- Product/merchant visibility, ratings, verification, discounts and delivery estimates must be supported by actual records.

### 10.3 Reference lifecycle, not a replacement schema

The HTML illustrates:

```text
new → preparing → ready → picked → arrived → delivered
  ↘ cancelled (only the demonstrated limited cancellation path)
```

Map these display concepts to current backend states. Do not rename database enum values or remove additional existing branches. Substitutions, cancellations, refunds, partial delivery and failed-delivery rules remain governed by the real application.

UNRESOLVED in the supplied materials: full multi-shop checkout policy, production cancellation/refund policy, final OTP provider, all payment/settlement rules, final mobile frameworks and API shape. Inspect the project before deciding. Where it still lacks a decision, document it instead of inventing one.

### 10.4 Keep fixtures isolated

The HTML's fixed date, demo shops, illustrative products, order IDs, sample metrics, `123456` authentication code and `1234` delivery code are review/test fixtures only. Do not seed them into live data or enable them in production authentication.

Fixtures may be used for component stories, local design review and deterministic tests behind an explicit nonproduction boundary. Missing live services should not silently activate a mock provider in a deployed build.

---

## 11. Responsive, accessibility and motion requirements

### 11.1 Responsive coverage

Implement the reference's behavior, not five fixed-size canvases.

| Width/context | Review expectation |
|---|---|
| 320px | Critical actions still usable; no page-level horizontal overflow |
| 390px | Customer/rider primary mobile composition, narrow operational navigation |
| 768px | Tablet and drawer transitions, readable forms and tables |
| 1024px | Compact desktop hierarchy and chart/table reflow |
| 1440px | Full desktop baseline |
| Native devices | Actual safe areas, text scaling, keyboards, orientation and back navigation |

Use the actual app framework's breakpoint approach. The reference switches major review/operations behavior around 800px; do not paste a conflicting framework preset without checking the rendered result.

Sticky footers and bottom navigation must not cover the final form control or primary button. Keep scroll within appropriate regions without trapping the user. The production interface must not retain phone frames or spaces reserved for removed preview chrome.

### 11.2 Accessibility

Use semantic landmarks, actual buttons/links, labeled form controls, headings in order and meaningful status text. Icon-only controls need accessible names. Selected states and alerts must not depend solely on colour.

Test focus visibility, modal behavior, keyboard navigation, zoom/text scaling, contrast in both appearances and long localized text. Preserve logical direction for mixed English/Urdu content; use logical spacing/alignment properties where relevant. Do not mirror a trademark or product photograph as an RTL adaptation.

The source's one-button contrast indicator is not a full accessibility pass. Verify implemented components and overlays independently. [R7]

### 11.3 Motion

Use brief, purposeful transitions for drawers, menus, tabs and state changes. Suggested implementation range: roughly 120–220ms for common UI transitions, adjusted for existing conventions. This is a handoff default, not a measurement from v5.

Respect reduced-motion preferences. Remove large movement and nonessential chart animation for those users. Do not loop decorative pulses, count-up money animations or fake delivery progress. Motion must not delay checkout, POS or rider actions. [R4]

---

## 12. Phased execution — complete slices, not broad superficial changes

### Phase A — Evidence and mapping

Audit the existing apps, inspect the HTML, establish baseline builds/screenshots, and map all reference views. Extract approved assets and record gaps.

### Phase B — Shared foundation

Implement compatible tokens, logo/font usage, primitives, theme derivation and the review Theme Studio. Check one form, table, tooltip and chart in light/dark/custom accents before spreading styles.

### Phase C — Establish visual quality

Implement admin dashboard + orders and merchant dashboard + orders. Use actual charts/tables and real service adapters. Review desktop/mobile screenshots against the same reference areas. Implement POS in the approved scope or isolated concept review.

Do not continue copying a poor foundation across every route. Correct navigation, type, spacing, chart sizing and density here first.

### Phase D — Customer experiences

Implement customer website and customer mobile browsing, product, basket, checkout and tracking. Then complete history, saved items, account and help. Preserve existing transactions and authentication behavior.

### Phase E — Rider and remaining operations

Implement the rider's full task flow, then complete inventory, merchant tools and the remaining admin modules. Keep unavailable and concept-only capabilities explicitly classified.

### Phase F — Regression and handoff

Run builds and tests, compare screenshots, inspect theme/RTL/mobile states, and update the route map with actual results. Remove accidental demo-only affordances from production surfaces. Leave unresolved backend work visible rather than calling it finished.

When working across sessions, update the implementation record with the last completed slice, real blockers and the exact next task. Do not restart the app architecture because context changed.

---

## 13. Verification contract

**These are tests Codex must run on the implementation, not claims about tests performed by this Markdown's author.** Previous prototype smoke-check counts are not proof that the real apps pass.

### 13.1 Visual comparison

For every mapped implemented view, capture its intended primary viewport in Original light and dark. For each of the five main screens, cover 320, 390, 768, 1024 and 1440px where web rendering applies. Include representative narrow/wide Theme Studio states and at least one alternate accent in light/dark.

Match browser, viewport, zoom, data fixture, font availability, theme and open-panel state. Crop/remove review-only rails on both sides of the comparison; do not compare a production header with a prototype's extra 56px review toolbar.

Check structure first: navigation, section order, widths, alignment and spacing. Then inspect font hierarchy, logo, colours, radii, table density, chart labels and interactions. Use overlays/diffs where tooling exists. Document intentional legibility or backend-state deviations.

Playwright supports screenshot comparisons, but reproducibility depends on a consistent environment. Store baselines intentionally; do not auto-approve every changed snapshot. [R5]

### 13.2 Functional checks

| Test group | Required checks |
|---|---|
| Branding | Correct SVG geometry, exact single-line Urdu, compact/reversed variants, no leaf or substituted mark |
| Theme | Eight presets, custom HEX normalization, invalid input, light/dark/system, sidebar, density, radii, logo preview off by default |
| Theme safety | Invalid/corrupt storage, 32 KiB import limit, unknown keys ignored, JSON round-trip, reset preserves business state |
| Theme continuity | Navigation and overlays preserve theme; chart labels/tooltips are readable; form input is not remounted/lost on colour changes |
| Customer | Browse anonymously, retain basket, checkout failure/retry, real auth gate, explicit order submission, correct totals |
| Merchant | Own-scope orders/products/riders, correct enabled actions, no stock mutation from a purely visual control |
| Rider | Assigned work only, correct payment instruction, real completion validation, no premature cash clearance |
| Admin | Permission-aware routes/actions, real moderation outcomes, no cross-role impersonation |
| Charts | Toggle changes measure and unit, scope/period accurate, empty/null data, all statuses accounted for, no invented deltas |
| Tables | Filter/sort/page scope, row actions, no-results, selection, safe export, narrow-screen behavior |
| Forms/overlays | Validation, duplicate-submit protection, dirty close, focus return, Escape, portaled theme |
| Production boundary | No demo auth codes/providers, preview role switcher, fixture transactions or production HTML-data export |

Use local/staging/test environments for mutation tests. Do not place real orders, send live messages, collect payments or initiate payouts merely to pass a design test.

### 13.3 Technical checks

Run the repository's applicable typecheck, lint, build and existing tests. Record actual commands and outcomes. Check browser console/runtime errors, hydration warnings, broken assets and unnecessary bundle regressions. Test native targets with their existing tooling where available.

Report unavailable tooling or blocked services honestly. Never write “all apps tested” when only web previews or one dashboard were exercised.

---

## 14. Definition of done and final response from Codex

A screen is complete only when it:

- Exists in the correct current app/route and matches the reference hierarchy.
- Uses the shared theme and approved identity, including its relevant states.
- Preserves existing integrations and business rules, or clearly states why a feature is unavailable.
- Works responsively and has been checked at its required viewports.
- Has passing relevant tests or a specific documented pre-existing/blocking failure.
- Has no unlabeled demo data or fake success behavior.

The whole task is not complete just because all five headers have changed colour. Conversely, a backend-missing concept screen must not be described as live implementation to reach a numerical screen target.

At completion, provide:

```text
1. Apps and actual routes changed.
2. Shared components, charts and theme implementation added/reused.
3. Production behavior preserved and any explicit deviations.
4. Missing apps/services, Concept modules and remaining blockers.
5. Files changed and dependency changes with reasons.
6. Commands/tests run, results and screenshot locations.
7. How the owner opens the updated apps and Theme Studio review surface.
8. Exact next steps for any unfinished scope.
```

Do not manufacture a launch-readiness, accessibility or security certification. Do not claim files were changed outside the accessible repositories.

---

## 15. Non-negotiable rejection checks

Reject an implementation that does any of the following:

- Produces another standalone demo instead of modifying the existing apps.
- Embeds the whole reference HTML or copies its global string-rendering script as application architecture.
- Changes only colours while ignoring layout, screens, chart behavior and component states.
- Replaces the selected logo, changes the Urdu wording/layout or treats a preview accent as a new approved brand.
- Forces a new framework, router, database, payment provider or authentication service without an explicit need and approval.
- Drops working features merely because the demo did not show them.
- Exposes a five-role switcher or bypasses permissions in production.
- Uses customer/rider screens as generic analytics dashboards.
- Adds fake data, percentages, ratings, delivery guarantees or success messages to fill space.
- Ships fixed demo verification codes or fictional transaction state as real functionality.
- Applies theme imports as unvalidated CSS/HTML or exports live private application data to a review file.
- Calls the implementation done without route coverage and visual/interaction verification.

---

## 16. Optional repository instruction hook

Where repository policy allows, add a short pointer to the appropriate existing `AGENTS.md`; do not overwrite its existing content or contradict local instructions. Codex's documented project-instruction mechanism uses `AGENTS.md`. [R8]

```md
## SirfBazar interface work

For SirfBazar design tasks, read SIRFBAZAR_CODEX_DESIGN_IMPLEMENTATION.md and
inspect the supplied HTML reference before editing. Apply the visual system to
existing apps rather than scaffolding replacements. Preserve business logic,
role boundaries and approved basket branding. Keep the implementation status
map current and verify screenshots, themes and workflows before completion.
```

Use the actual relative path when the Markdown is not at the repository root. In a multi-repository project, place the relevant pointer in each repository only where authorized.

---

## 17. Source register and known limits

### Project sources inspected for this handoff

| ID | Source | Used for |
|---|---|---|
| P1 | `SirfBazar_Design_Studio_v5.html` | Rendered structure, embedded assets, five interfaces, theme implementation |
| P2 | `BRANDING.md` | Owner-selected identity, approved asset names, original palette and slogan |
| P3 | v5 `docs/THEME_STUDIO.md` and `source/theme-studio.js` | Exact settings schema, presets, runtime token values, persistence and import/export behavior |
| P4 | v5 `docs/FIVE_APP_DESIGN.md` and `docs/SCREEN_DIRECTORY.md` | Role boundaries, 68 reference views, fixture limitations, Concept modules |
| P5 | v5 `docs/DESIGN_REFINEMENT_V5.md`, `source/refinement.css`, `source/refinement.js` and delivered previews | Latest shell/dashboard/storefront refinements and production-versus-review distinctions |
| P6 | Owner's latest project instructions | Implement into current apps; add React graphs/components; retain theme exploration |

Inspected HTML file size: **441,179 bytes**. SHA-256:

```text
7f56ea3147ef296518b3f01b3265969569ca80a8c5b8012e2eaff7b26c1242a9
```

This identifies the inspected baseline, not a rule to reject the owner's newer export. A newer supplied reference must be explicitly identified, inspected and recorded before assuming it overrides this one.

No real application repository, endpoint, production user record or finalized framework assignment was verified by this document's author. Production integration, QA requirements, component boundaries and workflow phases are handoff instructions, not claims about what the prototype already implements.

### Technical references

Technical documentation checked on 27 September 2026. These explain implementation tools; they do not add product scope or override the supplied design. Match actual installed versions rather than installing every latest release.

```text
R1 — shadcn/ui chart composition, Recharts, theming and container sizing
https://ui.shadcn.com/docs/components/chart

R2 — shadcn/ui token conventions and theming
https://ui.shadcn.com/docs/theming

R3 — TanStack Table overview / headless table behavior
https://tanstack.com/table/latest/docs/overview

R4 — Motion for React accessibility and reduced motion
https://motion.dev/docs/react-accessibility

R5 — Playwright visual comparisons
https://playwright.dev/docs/test-snapshots

R6 — React Native core/native components
https://reactnative.dev/docs/intro-react-native-components

R7 — W3C: Understanding Contrast (Minimum)
https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

R8 — OpenAI: project instructions with AGENTS.md
https://developers.openai.com/codex/guides/agents-md
```

DreamPOS remains the owner's module-organization inspiration, not a requirement to buy, clone or replace the project with its template. The inspected SirfBazar HTML is the actual visual target for this implementation.

---

## Appendix A. Complete reference route inventory

The following names/routes are copied from the v5 screen directory. They are **reference IDs**, not instructions to rename real production URLs. Map each to the actual current route using section 2.3. [P4]

### A1. Customer mobile app · 11 route views

| Screen | Route | Note |
|---|---|---|
| Home | `#customer/home` | Role-specific design view |
| Categories | `#customer/categories` | Role-specific design view |
| Shop | `#customer/shop` | Role-specific design view |
| Product details | `#customer/product` | Role-specific design view |
| Basket | `#customer/basket` | Role-specific design view |
| Checkout | `#customer/checkout` | Role-specific design view |
| Track order | `#customer/tracking` | Role-specific design view |
| My orders | `#customer/orders` | Role-specific design view |
| Saved items | `#customer/saved` | Role-specific design view |
| Account | `#customer/account` | Role-specific design view |
| Help | `#customer/help` | Role-specific design view |

### A2. Customer website · 11 route views

| Screen | Route | Note |
|---|---|---|
| Home | `#website/home` | Role-specific design view |
| Browse products | `#website/categories` | Role-specific design view |
| Shop page | `#website/shop` | Role-specific design view |
| Product details | `#website/product` | Role-specific design view |
| Shopping basket | `#website/basket` | Role-specific design view |
| Checkout | `#website/checkout` | Role-specific design view |
| Order tracking | `#website/tracking` | Role-specific design view |
| My orders | `#website/orders` | Role-specific design view |
| Saved items | `#website/saved` | Role-specific design view |
| My account | `#website/account` | Role-specific design view |
| Help centre | `#website/help` | Role-specific design view |

### A3. Merchant workspace · 19 route views

| Screen | Route | Note |
|---|---|---|
| Overview | `#merchant/dashboard` | Role-specific design view |
| Online orders | `#merchant/orders` | Role-specific design view |
| Products | `#merchant/products` | Role-specific design view |
| Add product | `#merchant/create-product` | Role-specific design view |
| Categories & units | `#merchant/categories` | Role-specific design view |
| Stock & expiry | `#merchant/stock` | Role-specific design view |
| In-store POS | `#merchant/pos` | Proposed merchant retail extension |
| Purchase orders | `#merchant/purchases` | Proposed merchant retail extension |
| Suppliers | `#merchant/suppliers` | Proposed merchant retail extension |
| Invoices | `#merchant/invoices` | Role-specific design view |
| Returns | `#merchant/returns` | Role-specific design view |
| My riders | `#merchant/riders` | Role-specific design view |
| Customers | `#merchant/customers` | Role-specific design view |
| Coupons | `#merchant/coupons` | Role-specific design view |
| Settlements & COD | `#merchant/settlements` | Role-specific design view |
| Reports | `#merchant/reports` | Role-specific design view |
| Team & permissions | `#merchant/team` | Role-specific design view |
| Support | `#merchant/support` | Role-specific design view |
| Shop settings | `#merchant/settings` | Role-specific design view |

### A4. Rider app · 8 route views

| Screen | Route | Note |
|---|---|---|
| Assignments | `#rider/home` | Role-specific design view |
| Pickup checklist | `#rider/pickup` | Role-specific design view |
| Delivery details | `#rider/delivery` | Role-specific design view |
| Complete delivery | `#rider/proof` | Role-specific design view |
| Delivery history | `#rider/history` | Role-specific design view |
| Cash handover | `#rider/cash` | Role-specific design view |
| Get help | `#rider/support` | Role-specific design view |
| My profile | `#rider/account` | Role-specific design view |

### A5. Platform admin · 19 route views

| Screen | Route | Note |
|---|---|---|
| Overview | `#admin/dashboard` | Role-specific design view |
| All orders | `#admin/orders` | Role-specific design view |
| Merchants | `#admin/merchants` | Role-specific design view |
| Catalogue moderation | `#admin/catalogue` | Role-specific design view |
| Categories & units | `#admin/categories` | Role-specific design view |
| Customers | `#admin/customers` | Role-specific design view |
| Merchant riders | `#admin/riders` | Role-specific design view |
| Returns & disputes | `#admin/returns` | Role-specific design view |
| Support inbox | `#admin/support` | Role-specific design view |
| Service areas | `#admin/areas` | Role-specific design view |
| Settlements & COD | `#admin/settlements` | Role-specific design view |
| Commission rules | `#admin/commissions` | Role-specific design view |
| Promotions | `#admin/promotions` | Role-specific design view |
| Content manager | `#admin/cms` | Role-specific design view |
| Reports | `#admin/reports` | Role-specific design view |
| Roles & permissions | `#admin/roles` | Role-specific design view |
| Integrations | `#admin/integrations` | Role-specific design view |
| Audit activity | `#admin/audit` | Role-specific design view |
| Settings | `#admin/settings` | Role-specific design view |


### A6. In-page states to map as well

Order detail drawers, checkout authentication, destructive confirmations, product editing, stock adjustments, merchant review, supplier/purchase forms, support notes, delivery validation, financial statement previews and exports are additional component states, not extra applications. Preserve existing production states that go beyond this prototype.

---

## Appendix B. Copy-ready implementation request

```text
Read SIRFBAZAR_CODEX_DESIGN_IMPLEMENTATION.md and inspect the attached
SirfBazar HTML before changing code. Apply that design to my existing five
apps, not a new demo or replacement project.

First audit the repositories and map the HTML views to actual routes. Then
implement in phases using the existing architecture and service integrations.
Use the agreed React chart/component stack where compatible, shared tokens,
and the Theme Studio colour controls. Preserve the approved basket logo,
#009966 default brand colour and single-line Urdu slogan.

Preserve authentication, permissions, order/payment/inventory logic and
merchant-owned riders. Keep prototype role switching, fixture data and
Concept modules out of production unless already approved.

Do not stop at a plan. Implement the accessible scope, compare reference and
implementation screenshots, test the actual workflows and themes, and
report changed routes, results and specific blockers without claiming
unavailable integrations work.
```
