# Merchant catalogue: approved design A

Date: 2026-10-08

## Scope and deployment

The user approved concept A and authorized production publication. This release changes the merchant Products > Browse catalog presentation only, plus its browser regression script. It uses the existing category tree, catalogue and bulk-upload API contracts. No database migration, API deployment, configuration change or WhatsApp OTP change is required.

Publish this isolated commit on top of production baseline `32496056a221fa2b55a6070486f151ec6483360d`; do not merge the entire development branch. The standard GitHub/Vercel deployment builds the web projects. Verify the merchant deployment succeeds and the public asset manifest serves the new Products bundle.

## Delivered interactions

- Expandable category/subcategory rail and category-scoped search; the API remains the source of category membership.
- Photo cards with whole-card and keyboard selection, explicit selected/already-listed states, and failed-image fallback.
- Right-hand review pane with per-product selling price and stock, removal and bulk add.
- Selection retained while changing categories and opening/closing CSV import. Successful imports refresh availability.
- Visible-page select-all and explicitly labelled current-page alphabetical sorting.
- Existing immutable request/retry handling retained for partial results; edits remain locked until the batch is resolved or failed rows are explicitly reopened.
- Responsive category disclosure and review shortcut on narrow screens; existing merchant shell and theme retained.

## Interface review

Focused better-interface review influenced grouping, field labels, keyboard focus and narrow-screen behavior.

- Accessibility: native labelled checkboxes and buttons; separate category disclosure with expanded state; product-specific price/stock labels; invalid-field focus; mobile review moves focus. Keyboard Enter/Space, whole-card click and modal Escape tested. No full screen-reader certification claimed.
- Layout: desktop three-region composition, paired review fields, responsive two-column and single-column fallbacks. No horizontal document overflow at 320, 390, 720, 1024 or 1440 CSS pixels in fixture checks.
- Writing: actionable empty/error copy, explicit current-page sorting, already-listed state and server-confirmation note. No fabricated product counts or sample catalogue records shipped.
- Typography: existing brand font/tokens retained; names wrap, numerical price/stock fields use tabular figures, mobile fields use 16px text.
- Color: existing light/dark tokens retained, with text/checkmark states in addition to color. Import control explicitly uses theme surface/ink to avoid white-on-white dark mode text found during visual review.
- UI: scoped stylesheet avoids unrelated screens; shared icon library, image fallback, consistent selection border and reduced-motion support.

## Verification

- Merchant TypeScript/Vite production build passes. Existing entry chunk size warning remains; no dependency changes.
- 23 catalogue/category, CSV, iPOS/API integration and order-alert unit tests pass.
- `scripts/check-category-browser.cjs` passes against the built local preview: category filtering, cross-category selection, keyboard and card selection, visible select-all, sort, blank-price rejection/focus, price-to-paisa conversion, import-dialog draft preservation, immutable partial retry, successful-row exclusion on retry, empty/error recovery and responsive controls.
- All browser API writes are intercepted fixtures. No live inventory was altered for testing. Screenshots cover desktop light/dark and 320px.

## Rollback

Revert only this design release commit on the production branch and let the existing web deployment rebuild. Do not reset shared history or roll back backend/category data for a frontend-only issue.
