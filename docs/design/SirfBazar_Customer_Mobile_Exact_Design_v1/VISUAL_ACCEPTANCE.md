# Native visual acceptance

## What “exact” covers

Keep the same app-controlled layout, content order, original logos/icons, component dimensions, typography hierarchy, palette, borders/radii, selection treatments, sheet hierarchy and next-action placement as the reference. The original screenshot is not a suggestion to choose a new template.

Use `REFERENCE_LOCK.json`; do not alter expected images, source CSS, icons or fixtures to erase differences. Do not widen diff thresholds or add broad masks until a failure disappears. A visually identical screenshot with no working controls is not an implementation.

## Comparison conditions

Primary reference is390 × 844 logical viewport, device scale 2, PNG780 × 1688. Screenshot files are visible viewports, not complete scroll areas. Match scale, scene, content, theme, fonts and settled animation before comparing. Use320/360/412logical widths and real supported phone sizes to test adaptation, not arbitrary physical screenshot sizes as dp.

The current browser reported Inter/Inter-Bold on the home hero. Plus Jakarta Sans is the intended leading family but is not bundled/downloaded by this reference. Record actual native family/weights and compare fairly. Difference in OS text rasterization is narrower than a changed font or altered layout. Do not stretch fonts or entire screens to force similarity.

Native safe areas, status/navigation bars, keyboard and OS permission dialogs are platform-owned. Exclude only those precisely documented areas from content comparison. Never draw fake 9:41/status icons under a real system status bar. The synthetic phone device frame, scene chooser and inspector are omitted completely.

## Coverage

All 42 compositions need light and dark review (84reference images). Implement with shared screens and current data states; a route per screenshot is not required. Cover below-fold content, expanded search filters, quantity stepper after Add, empty basket, sign-in cancellation and sheets. Preserve user inputs across theme switching and back navigation.

Screens with dynamic customer information must use isolated fictional fixtures for visual tests. No credentials, real customer address, phone number, verification code, merchant financial record or rider location may be copied into a public fixture or Stitch prompt. Normal application routes use authenticated API results and no demo fallback.

## Required evidence sequence

1. Record current device/platform/build, logical dimensions, pixel scale, locale, font and effective theme.
2. Capture the actual native screen with matching fixture content and scroll position.
3. Compare original reference side-by-side, overlay and difference images. `tools/compare_png.py` requires equal pixel sizes; documented native-safe-area crops must be created explicitly, never silently stretched.
4. Correct genuine layout, line-wrap, icon/color, control or sheet differences and capture again.
5. Log remaining narrow native/system differences with rationale; do not label gaps done by simply calling them native differences.
6. Run behavioral checks independently of screenshot similarity.

## Behavioral acceptance

Browse/Add/Basket never forces auth. Late sign-in keeps guest/draft state. Successful auth does not place an order. Failed/uncertain merge is not skipped. Final review uses current destination-aware fees. Place requires explicit consent and no blind retry. Multi-shop identity remains visible. Automatic development payment confirm is absent. Customer order tracking cannot mutate merchant/rider states. Light/Dark/System do not reset data. Keyboard, hardware back, reduced motion, screen readers and text scaling work without clipped actions.

No exact numeric pixel-match percentage is guaranteed by this pack. A helper's image-diff score is diagnostic, not a production usability, accessibility or security certificate. QA_RESULTS.json reports only actual local browser checks from this design turn, not native tests.
