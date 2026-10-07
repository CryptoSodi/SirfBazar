# Merchant category frontend release — 8 October 2026

## Scope

Merchant `/products` → Browse catalog. Keep SirfBazar's existing visual design; adopt the parent/subsection filtering and persistent bulk-selection behaviour verified in KeeperApplication's `AddBulkOrder.razor` (reference commit `fa7ef29827b6d96464e2f88149a2a6f3137f42dc`). The reference fetches taxonomy from its backend; it does not contain a static category dataset to copy.

SirfBazar's live API already supplies 26 root categories and 123 subsections. This release does not change those records or the API, database, prices, stock, credentials or WhatsApp sessions.

## Behaviour

- Selecting a parent also opens its children and shows products across that branch.
- Selecting Fresh Fruits or Fresh Vegetables filters by that subsection's exact ID. The results heading names the selected path. All category branches use the same recursive component.
- Selections and entered prices/quantities remain when switching categories, searching or paging within the catalogue.
- Select/deselect visible affects eligible products on the current page only, not hidden selections or every page. Already-listed products are excluded.
- Add selected sends ADD_MISSING with a request ID, server-validated shop context and integer paisa. Confirmed completed rows clear; partial failures retain recovery controls and retries retain the original payload.
- Empty filtered results offer Show all products; failed loads offer Retry.
- Existing design tokens, product cards, page layout, responsive breakpoints and themes are retained. No copy of KeeperApplication styling, new sorting backend, or whole-card selection is included.

## Interface review

React/Vite; existing merchant CSS. Instructions: AGENTS.md and better-interface domain skills. Scope is this flow, not all merchant pages.

| Domain | Evidence | Result |
| --- | --- | --- |
| Accessibility | Native category buttons/checkboxes, explicit product names, keyboard Enter expansion, existing visible focus ring, status/error regions | Targeted checks passed; screen-reader and forced-colors sessions not verified |
| Layout | Desktop 1440px and narrow 320px browser captures | Three columns at desktop; content reflows without horizontal overflow at 320px |
| Writing | Active category path, scoped select-visible wording, empty/error recovery | No actionable findings in changed copy |
| Typography | Existing fonts/sizes retained; new heading uses existing 16px scale and wrapping | Viewed desktop/narrow screenshots; 200% zoom and localization not verified |
| Colors | No palette changes; existing semantic tokens retained | Light/dark screenshots viewed; exhaustive measured contrast not verified |
| UI | Existing card and checkbox design, native disclosure, selected review and partial-result state | No new visual system or animation introduced |

### Findings

No remaining actionable findings in the inspected changes. Prior source-comparison differences involving A–Z/Z–A and whole-card click selection are not part of this category-only request.

### Verification

- Merchant TypeScript check passed.
- Category-path and CSV tests: 7 passed.
- iPOS regression tests: 12 passed.
- Merchant Vite production build passed (existing 525 kB entry-chunk warning remains).
- `scripts/check-category-browser.cjs`: isolated fixture verifies keyboard parent expansion, independent subsection results, selection persistence across departments, select/deselect visible, existing-listing exclusion, paisa conversion, immutable retry, partial-result reconciliation, empty/error recovery and 320px overflow.
- Browser fixture intercepts all API calls and aborts sockets. Expected fixture 503/blocked socket messages are not production errors. No real shop writes, OTPs, orders or payments are exercised.

### Verdict

Approve the inspected category/bulk-selection frontend flow within the verification limits above. Production publication must be checked separately by the served asset and route; a Git push alone is not deployment confirmation.

## Release boundary

Publish the merchant app and its already-reviewed fixes from the release branch, without replacing API or other app source on the production branch. The remote API host must stay on its already-updated release; this merchant-only production commit is not a backend rollback target. No new APK is produced by this deployment.
