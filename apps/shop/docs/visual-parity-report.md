# Visual parity — actual React workspace

Status updated 2026-09-29: selected React routes were smoke-viewed in the in-app browser, but **the 15-image, same-condition pixel comparison is NOT RUN**. No React capture file, unchanged-HTML paired capture, overlay/diff, font match or parity percentage is asserted here. The integrity helper passed for the 32 original source files; that is not a visual comparison.

| Condition | Recorded value |
|---|---|
| Untouched source | `../../SirfBazar_Codex_Exact_Design/reference/SirfBazar_Merchant_Workspace.html`; SHA-256 `1d1dc55f7a08ab9f2b09ef63f7b3ee56a8ed6f7f5f1df1e07cae8aefce111daa` |
| Original source file check | PASS: `python SirfBazar_Codex_Exact_Design/tools/verify_reference.py`, 32 locked files |
| Actual application URL / authenticated route | Frontend at `http://127.0.0.1:5175`; exact smoke URLs/session identity not recorded here |
| Browser/version, OS, viewport, DPR, zoom | In-app browser on Windows, narrow-width smoke reported; numeric viewport, DPR, zoom and browser version NOT RECORDED |
| Font loading/rendered family, locale, timezone, clock, motion setting | NOT RECORDED |
| Fixture provider isolated from production | NOT VERIFIED |
| Actual React screenshots and overlays/diffs | IAB smoke screenshots viewed for Overview, Orders, Team, Products and Profile; retained capture paths and overlays/diffs NOT RECORDED |

## Smoke review actually reported

The seven main views now have React routes and are styled with the copied `public/merchant-v2.css` plus React-only aliases. The IAB smoke review covered Overview, Orders, Team, Products and narrow-width Profile. This confirms those screens rendered for visual inspection; it does **not** establish identical fixture content, font/platform conditions, full interaction states or pixel geometry against the locked screenshots. Riders, Earnings, source drawers, dark/system variants and auth regressions were not recorded in that smoke set. The local synthetic database has empty operational records, so populated tables and chart series were not compared.

## Original target coverage

These are required comparisons, **not** passed checks. A smoke-viewed route is not an original-PNG comparison. Capture the untouched source and the actual React components under the same browser/viewport/DPR/font/locale/timezone/theme/fixture/focus/scroll/settled-motion conditions. Original PNG dimensions are file dimensions, not necessarily historical viewport heights.

| Target | Selected reference | Actual React capture | Same conditions / diff | Result |
|---|---|---|---|---|
| Overview Light | `reference/screens/01-overview-light.png` | Route smoke viewed; theme/file not recorded | NOT RUN | PENDING |
| Overview Dark | `reference/screens/02-overview-dark.png` | NOT CAPTURED | NOT RUN | PENDING |
| Order review Light | `reference/screens/03-order-review-light.png` | NOT CAPTURED | NOT RUN | PENDING |
| Assign rider Light | `reference/screens/04-assign-rider-light.png` | NOT CAPTURED | NOT RUN | PENDING |
| Assign rider Dark | `reference/screens/05-assign-rider-dark.png` | NOT CAPTURED | NOT RUN | PENDING |
| Orders Light | `reference/screens/06-orders-light.png` | Route smoke viewed; theme/file not recorded | NOT RUN | PENDING |
| Riders Dark | `reference/screens/07-riders-dark.png` | NOT CAPTURED | NOT RUN | PENDING |
| Products Light | `reference/screens/08-products-light.png` | Route smoke viewed; theme/file not recorded | NOT RUN | PENDING |
| Earnings Dark | `reference/screens/09-earnings-dark.png` | NOT CAPTURED | NOT RUN | PENDING |
| Settings Dark | `reference/screens/10-settings-dark.png` | Narrow Profile smoke viewed; file not retained, theme not recorded | NOT RUN | PENDING |
| New shop Light | `reference/screens/11-new-shop-light.png` | NOT CAPTURED | NOT RUN | PENDING |
| API error Dark | `reference/screens/12-api-error-dark.png` | NOT CAPTURED | NOT RUN | PENDING |
| Narrow browser 390px | `reference/screens/13-narrow-browser.png` | Narrow Profile smoke viewed; exact width/file not recorded | NOT RUN | PENDING |
| No eligible riders Dark | `reference/screens/14-no-riders-dark.png` | NOT CAPTURED | NOT RUN | PENDING |
| Busy rider Dark | `reference/screens/15-busy-rider-dark.png` | NOT CAPTURED | NOT RUN | PENDING |

## Additional acceptance matrix

- [ ] All seven views in **both** Light and Dark; Team has no historical PNG, so compare to a newly captured unchanged-HTML state, not a fabricated original.
- [ ] System follows OS changes while selected; switching theme preserves form, selection, filters, scroll and pending requests.
- [ ] Viewports 1600, 1440, 1366, 1024, 800 and 390px; source breakpoints 1600/1200/1050/800/480px; no document-wide horizontal overflow or scaled-down desktop canvas.
- [ ] Loading, empty/new shop, initial error, stale refresh, expired session, denied/restricted staff, no rider, busy rider, pending/confirmed/rejected/uncertain mutation states.
- [ ] Keyboard navigation, Escape/focus return for drawers/dialogs, focus-only outlines, reduced motion and contrast on both themes.
- [ ] Capture with **actual React code** using a private deterministic fixture story if needed. Do not ship fixtures or unauthenticated screenshot routes in production.
- [ ] Side-by-side and equal-sized overlay/diff for each target; record measured geometry/raster differences, corrections, remaining mismatch and narrowly scoped exclusions. Do not resize/mask primary regions or overwrite the approved PNGs.
- [ ] Production-composition check separately confirms removal of review-only chrome while preserving business layout and live data path.

Suggested evidence row for each future capture: route/state/theme, untouched HTML capture, React capture, browser/version, CSS viewport/DPR/zoom, rendered font, fixture hash, overlay/diff path, measured differences, corrected issue, unresolved deviation and reviewer/date. `tools/capture_reference.py` captures only the HTML; it never proves the React app matched.
