# Readable pinned locations

## Interaction plan

The header currently receives a hard-coded coordinate label from LocationPicker.
Keep the exact selected coordinates and synchronous confirmation. Resolve the
header's display label separately with the existing Google Maps browser key and
SDK loader; never substitute the nearest serving shop's district.

Existing coordinate-only saved pins should also resolve when the header mounts.
Debounce lookups, fence late responses when a pin changes, and time out without
blocking discovery. No persistent Google address cache: results are display-only
React state, with visible Google Maps attribution; user-entered labels alone are
saved. Google API unavailable/no result: a neutral Pinned location label and
editable Area or address name in the existing picker. Do not invent plot numbers.
Changing the pin clears a previous manual name; unchanged centre events do not.

Sources: [Google JavaScript Geocoding](https://developers.google.com/maps/documentation/javascript/geocoding)
and [attribution/storage policies](https://developers.google.com/maps/documentation/geocoding/policies).
Maps JavaScript and Geocoding APIs must be enabled for the existing browser key
and allowed referrers. This task does not enable billing, change keys or backend.

## Implementation and recovery

- LocationControl resolves only unnamed/legacy pins; user-written names take precedence.
- Google responses are fenced to the same coordinates and unmount lifetime. An
  8-second watchdog or failed lookup leaves the picker available without retries.
- LocationPicker saves a normalized manual label, or the neutral Pinned location
  fallback, synchronously with the selected coordinates. Moving the pin clears a
  previous manual name. Existing location/nearby refresh and toast paths remain.
- The existing recovery fixture exposed Leaflet centre rounding after GPS-driven
  setView. LocationMap now suppresses programmatic centre/resize callbacks so a
  rendered centre cannot overwrite exact saved/GPS coordinates or a manual name.
- No dependencies, backend, merchant/native apps, credentials or production data changed.

## Interface review

Scope: customer header location control and its existing location picker only.
Next/React, existing global semantic tokens/Tailwind utilities, and one scoped CSS
module for Google attribution. Conventions: AGENTS.md, existing Header,
LocationPicker, useModalFocus and Toast components. The better-interface workflow
and its six domain skills guided the existing-style field and fallback behavior.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Native labelled textbox/button; keyboard map/confirmation, Escape, focus restoration, focus outline and 320px viewport | Clear in tested browser; screen readers not verified |
| Layout | Header at 320, 390, 768 and 1440px in both themes; picker 320px and accessible sticky confirmation | Clear in tested states |
| Writing | Optional area/address label, example plot, explicit lookup fallback and name-clearing explanation; no claimed exact plot detection | Clear |
| Typography | 16px input; 12px unbroken Google Maps attribution; full header value in title and accessible name | Clear in tested states |
| Colors | Rendered attribution #5e5e5e on white = 6.48:1; white on #19221e = 16.29:1; existing picker text/control contrast regression passed | Clear |
| UI | Reused picker surface/input/button/icon/toast treatment; instant save and no new motion or blocking lookup layer | Clear |

No actionable interface findings in the reviewed flow. Approve for the tested
scope; this is not an all-app accessibility or real-device certification.

## Verification actually run

- Node 22: `--test test/*.test.cjs` in apps/web: **21/21 passed**.
- `next build` in apps/web: **passed**, including TypeScript and all 17 page builds.
  Existing React 18 deprecation warning remains unrelated to this fix.
- Playwright CLI `run-code --filename apps/web/test/location-name.browser.js` on
  local production build: **36 assertions passed**, with mocked Google geocoder
  and API. Covers exact point, legacy label, readable result, attribution, manual
  plot name, reload, pin-move clearing, refusal, late lookup and responsive themes.
- Existing `scripts/check-location-picker-browser.cjs` fixture via Playwright CLI,
  with its assert helpers inlined: **passed** exact confirmation, fresh/late GPS,
  nearby refresh, storage failure/retry, keyboard, Escape, focus and 320px reflow.
- Existing `apps/web/test/grocery-hero.browser.js` via Playwright CLI: **88/88 passed**
  guest discovery/cart, real location selection, theme/System, responsive widths,
  text resize, reduced motion, keyboard and failure/loading/empty states.
- `git diff --check`: passed.

Screenshots: output/playwright/location-name-light-1440.png,
location-name-dark-1440.png, location-name-picker-320.png and
location-name-saved-320.png. Tiles are intentionally blocked in fixtures, so a
grey map there is not evidence of a production map-service outage.

Not verified: actual Google Geocoding API/key entitlement, device GPS, physical
phone, screen-reader speech, browser 200% zoom or RTL. Google calls were mocked;
the fallback remains usable if the deployed API/key cannot return an address.
An exact plot number is only displayed when supplied by a returned address or
entered by the customer; it is never synthesized from coordinates.

## Release state

Changes are local on codex/readable-location-labels, not committed or deployed.
The prior dark-hero release is merged as ad9c9576, with all GitHub checks and the
normal API deployment passing. Vercel rejected that production deployment with
“Deployment rate limited — retry in 24 hours”; the website therefore still serves
the previous frontend. No quota bypass, billing or hosting changes were made.
