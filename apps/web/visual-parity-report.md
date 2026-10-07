# Customer interface review and visual parity

Updated 2026-10-05. Scope: changed Next.js customer screens in `apps/web`, CSS in `app/globals.css`, and supplied Light/Dark desktop/tablet/mobile screenshots. Existing project conventions in root `AGENTS.md` and `docs/architecture.md` guided the review. This is a scoped interface review, not an E2E release sign-off.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Header and mobile navigation, product-card labels, checkout and modal roles/focus code, browser accessibility tree | No actionable source finding; keyboard/screen-reader testing remains unverified. |
| Layout | Live home at 320, 390, 768, 1024, 1366, 1440; mobile product and desktop browse/shop | Loaded home has no document overflow at those widths. |
| Writing | Home, offer selection, basket and uncertain order/merge states | Clear about example location, missing images, quote review and uncertain mutations. |
| Typography | Headings, cards and mobile labels compared with references | Responsive hierarchy present; 320px hero wraps more than 390px reference. |
| Color | Light and Dark mobile home, tablet Light, design tokens | Dark hero and card controls corrected for contrast. |
| UI | Shell, home, browse, shop, product, basket and checkout source; visible home/browse/shop/product | Most structure matches; real catalogue assets differ from illustrations. |

| Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- |
| MEDIUM | Layout | `app/globals.css` home hero at 320px | Headline wraps to four lines | Tune art/copy balance at 320px after content sign-off | The narrowest layout remains usable but is taller than the supplied 390px composition. |

## Verification

Passed: production `npm run build`; browser-read catalogue/shop/product routes; 320/390/768/1024/1366/1440 home overflow sweep; Light and Dark mobile home; tablet header/navigation fit. The 390px live-data grid overflow and 768px header overflow found during review were fixed and rechecked.

Not verified: exact pixel-diff screenshots at every width, 200% zoom, screen reader, full keyboard walk-through, authenticated and write-path states. Product imagery cannot match reference packaging until catalogue image URLs exist.

Verdict: Approve for the inspected interface scope; do not treat this as production or transaction-flow approval.
