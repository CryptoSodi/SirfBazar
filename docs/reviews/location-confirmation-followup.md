# Customer location confirmation follow-up

## Scope and coverage

Customer web browsing-area selection only: Header, LocationPicker and its responsive shell. React/Next, existing tokens, modal focus helper and floating notifications retained. Root/project AGENTS, architecture, API contract, conventions, deployment, capability and remaining-work records were read; older planning claims are not treated as current production evidence.

The supplied phone recording was inspected locally. It shows a selected pin while the header keeps a different district label. Private footage and precise recorded coordinates are not committed or uploaded. The complete phone-specific cause cannot be established from a recording alone.

The implemented interaction is: choose a pin/current GPS -> inspect exact coordinates -> confirm synchronously -> persist and broadcast location -> refresh nearby requests -> close and show a success toast. Storage failure keeps the previous confirmed location and permits retry. Browsing-area selection does not modify delivery addresses or orders.

| Domain | Evidence | Result |
| --- | --- | --- |
| Accessibility | Named native buttons, keyboard map, focus restoration, mobile touch confirmation, fixed action/footer | Clear in inspected flow |
| Layout | Scrollable body and safe-area footer, 320px light/dark reflow | Clear in tested states |
| Writing | Exact pin label rather than a merchant district; success toast and storage recovery instructions | Clear |
| Typography | Existing type system, wrapping coordinates and full label available in reopened picker/header title | Clear |
| Colors | Existing tokens, automated light/dark computed text contrast >=4.5:1 | Clear in tested pairs |
| UI | Immediate confirmation without a network dependency; exact coordinates and action always visible | Clear |

## Findings addressed

| Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- |
| HIGH | Writing | apps/web/components/LocationPicker.tsx:55 | `/location/detect` supplies a serving shop's area as the customer's pin label | Exact `Pinned location` label with selected coordinates | A shop district is not a reverse-geocoded customer locality; unchanged district text can misleadingly imply that the pin was not updated |
| HIGH | UI | apps/web/components/LocationPicker.tsx:55 | Async area lookup shares cancellation generation with map events | Synchronous local save and location broadcast; no lookup required | Confirmation must not silently depend on lookup timing or map/viewport callbacks |
| HIGH | Layout | apps/web/components/LocationPicker.tsx:83 | Confirmation at the bottom of scrolling content | Coordinates and confirmation outside the scrollable body, with safe-area padding | The primary action remains reachable above mobile browser/system controls |

## Verification

- The strengthened browser fixture failed against the previous build's merchant-area lookup dependency, then passed against the corrected build.
- `node scripts/browser-catalog-location.mjs`: exact persisted pin, matching nearby-shop query coordinates, zero location-detect POSTs, pointer/keyboard/GPS selection, stale GPS fence, storage-failure retention/retry, mobile touch confirmation, focus restoration, 320px reflow and light/dark text-contrast checks.
- The location fixture uses mobile/touch emulation in the existing CI browser runner as well.
- Web production build and TypeScript pass; web unit regressions 11/11 pass. Existing React-18 deprecation warning remains.
- Confirm success uses the existing floating toast; no technical error or status is appended to the page body.
- Late automated review identified stale failed-save feedback after a successful retry. The retry now dismisses only that recovered error (session-scoped), preserving unrelated notifications. The fixture retries without manually dismissing the error and requires visible success and no stale error. Toast placement respects the location action bar so the retry button is not covered. Four actual-source cases cover targeted dismissal and session ownership.

Not verified: the user's physical phone after release, actual device GPS accuracy, assistive-technology announcements or 200% zoom. The API is not a reverse geocoder: this change deliberately avoids inventing a neighbourhood name. No new geocoding provider, backend contract, schema, OTP or deployment configuration changes.

## Verdict

Approve within this inspected flow and tested states, subject to protected CI and live verification. This is not whole-app accessibility certification.
