# Catalogue scrolling and location-picker review

Scope: merchant catalogue browsing and customer browsing-area/pin selection only. Existing React/Vite merchant and Next customer apps, native buttons, shared design tokens, existing modal-focus and toast components. Project AGENTS instructions and existing catalogue/customer design handoffs were followed. No payment, inventory mutation, authentication, OTP, production configuration or database changes.

## Scope and coverage

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Automatic append preserves checkbox focus; pause/resume control; live count; map arrow keys, Escape and focus restoration; 320px reflow | Clear in tested states |
| Layout | Inline map below Pick my area; scrollable mobile dialog; existing three-column catalogue preserved | Clear in tested states |
| Writing | Loading/finished counts, recoverable retry, GPS denial/map recovery and explicit browsing-vs-delivery copy | Clear |
| Typography | Existing type system retained, wrapping coordinates, rendered 320px picker | Clear |
| Colors | Computed text/control contrast >=4.5:1 in light/dark picker; dark map pin corrected to dark green with white halo | Clear in tested states |
| UI | Existing surfaces/radii, fixed-centre pin, no focus jump after append, exact coordinates confirmed | Clear in tested states |

No actionable interface findings remain within this inspected scope.

## Verification

- `node scripts/browser-catalog-location.mjs`: PASS against local production previews and intercepted APIs. Catalogue requests use 24-item batches, one pending request, deduplicate overlapping pages, preserve selected products and focus, pause on failure, retry only the failed page and stop at the final page. Customer picker restores saved coordinates, supports pointer/keyboard, uses fresh high-accuracy GPS, fences late GPS after manual selection, confirms exact displayed coordinates, restores focus and reflows at 320px. Light/dark text contrast assertions pass.
- Web `node --test test/*.test.cjs`: 11 tests pass, including Google SDK click/drag confirmation regressions and existing checkout recovery.
- Merchant catalogue/import/POS test files: 19 tests pass.
- Both app TypeScript checks and production builds pass. Existing Next React-18 deprecation and merchant chunk-size warnings remain.
- Browser fixtures are included in the existing release browser-regression runner. No real orders, messages, payments or shop modifications are made by these tests.

Not verified locally: real device GPS/provider accuracy, actual Google Maps credentials/network, external map tiles (fixtures intentionally block them), native apps, screen readers and 200% zoom. This is not a whole-app accessibility certification. Browser map uses the existing key-free OpenStreetMap provider; attribution is retained.

## Verdict

Approve for the inspected flow and tested states, subject to protected release CI and production deployment verification. The local review does not claim the unverified integrations above.
