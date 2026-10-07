# Visual acceptance — actual native app, not another HTML screenshot

## What must match

Compare every supplied app composition in Light and Dark: layout and section order, padding, gaps, readable hierarchy, font metrics, brand geometry, exact icon paths/weights, colors, borders, radii, state labels, controls, sheet placement, tab selection and fixed next-action dock. Inspect content below the first viewport as well as the initial screenshot.

Use `SCREEN_PARITY_MATRIX.md`; original screenshots are immutable. The desktop design-studio screenshot is review tooling, not a required native screen. The pickup sheet is a required overlay composition.

## Two distinct comparisons

**Reference integrity:** top-level `tools/verify_reference.py` checks all copied original bytes. It says nothing about native UI quality.

**Native visual fidelity:** capture the implemented Android/iOS screen, then compare against the HTML under controlled conditions. `tools/render_reference.py` produces new reference renders and measured DOM data in a separate directory; `tools/compare_screens.py` produces overlays/diffs from input PNGs. Neither tool runs the native application.

## Match the conditions first

Record reference version/hash, native commit/build, device/model/OS, logical width/height, image pixel size and device scale, display zoom, font scale, font family/available weights, theme/system mode, locale/timezone, source state, scroll offset, keyboard state and animation phase.

Reference default is 390×844 logical, scale 2. Do not mistake 780×1688 physical PNGs for native layout size. The browser's 28-unit fake status area is not a required actual device inset.

Use the exact fictional reference content in **isolated local tests only**. Preserve the reference's line lengths, item counts and values for comparisons. Production uses real records and never falls back to fixtures. Changing all names/amounts while comparing a screenshot invalidates text/layout conclusions.

Font caveat: the source declares Plus Jakarta Sans/Inter/Arial, but the original capture used an installed fallback, not a bundled font. Capture the untouched HTML again with the same legally available font as the native test when possible, without altering source assets or the original PNGs. Record that as a separate normalized comparison, never a replacement expected baseline.

## Comparison procedure

1. Verify reference hashes; inspect screenshots plus the interactive source.
2. Implement a small representative native section, then measure and correct it before duplicating styles.
3. Capture the whole native screen. Also capture the comparable app-controlled content region with safe-area measurements recorded.
4. Create a source render with the same logical content budget and matched test state. Keep original full PNGs for audit.
5. Compare side-by-side, then 50% overlay, then absolute diff. Quantitative pixel metrics are diagnostics, not an automatic native fidelity score.
6. Correct geometry first, then typography/wrapping, icon paths, semantic color pairs, border/radius/shadow and state interactions. Repeat.
7. Review long addresses, many items, no/unknown contacts, error text, larger text and keyboard; don't force production into reference-only short content.
8. Rerun light/dark screenshots after shared-component changes. Test System selection and OS change behavior separately from fixed screenshots.

The helper does **not** resize, align, mask or crop input images automatically. Unequal dimensions cause a clear error. Any normalization/cropping must be explicit and recorded with original images retained.

## Narrow permitted production differences

| Region | Difference permitted | What stays fixed |
|---|---|---|
| OS status/navigation bar | Actual device-owned bar instead of fake clock/battery/phone frame. | App header, safe-area color and content layout after the real inset. |
| Native keyboard/OS prompts/Google UI | Actual platform-controlled surfaces. | In-app explanation, inputs, button placement and recovery states. |
| Map illustration | Genuine configured map or honest nongeographic destination card. | Reference container hierarchy, address/contact controls and useful space; no fake tracking. |
| Demo-only copy/rails | Remove example notices, API notes and scenario controls. | Real merchant-facing/rider-facing sections and information hierarchy. |
| Dynamic data | Actual authorized names, prices, addresses, status/time. | Layout rules, intended wrapping and correct state rendering. |
| Typography rasterization | Disclose matched font conditions and residual engine differences. | Approved family direction, size/weight hierarchy, alignment and intended wrapping. |

These are not permission to swap navigation, round every card differently, remove low-level screens or replace a prominent hero with a generic list.

## Blocking conditions

Do not mark exact design complete when only Home was done, dark mode has light inputs/sheets, action docks cover content, native controls use unrelated defaults, source screenshots were replaced, code was embedded in a WebView, or all testing was in a browser.

A design-source view or old preview QA is not native evidence. If the environment has no emulator/device, report “implemented, native visual verification pending” with the exact missing tool. Continue source-backed implementation rather than claiming the design cannot be implemented.

## Interaction acceptance

Confirm theme changes preserve input/navigation, sheet cancel/back never mutates orders, focus returns sensibly, code errors and cash amounts stay above the keyboard, forbidden or expired sessions do not leak old customer details, no-assignment requires a successful empty response, and a timed-out delivery never automatically repeats or asks for cash again.

Confirm runtime uses real API data, with test fixtures isolated. Verify mutation persistence after refetch/relaunch only on approved test records. A native screenshot alone does not prove the assignment/order is saved.
