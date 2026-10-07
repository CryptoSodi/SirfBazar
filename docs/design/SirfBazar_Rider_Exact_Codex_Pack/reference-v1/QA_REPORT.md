# SirfBazar Rider design — local preview QA

**Date:** 29 September 2026  
**Scope:** browser design reference only. Not a test of Expo, native devices, production authentication, API deployment, GPS, payments or delivery operations.

## Results actually obtained

- **25 / 25 local automated checks passed** in the final test-only run.
- All **26 scene/state compositions rendered in both themes** (52 render checks within the suite).
- **28 / 28 selected solid-color contrast pairs** met their stated 4.5:1 text or 3:1 control/focus target. This is not whole-app accessibility certification.
- **36 screenshots** were produced: 26 light scenes, eight additional dark captures, one sheet and one desktop review shell.
- **No JavaScript page exceptions** and **no network requests** were observed by the preview test harness.
- Selected light/dark/home/navigation/code/review images were opened and visually inspected. Two overview boards were composed from actual screenshots.

## Check coverage

The suite tests all scene/theme rendering; horizontal overflow; action dock visibility; arrival; pickup acknowledgement; confirmation-sheet cancellation/focus containment; pickup to On the way; COD cash/parcel gates; preservation of code through theme switch; completed local journey; paid-order cash omission; issue-report validation; unchanged delivery after issue reporting; offline completion blocking; phone validation; distinct login-code screen; pending rider application; System-vs-explicit theme behavior; reduced-motion loading; responsive widths; session privacy composition; exceptions and network activity.

Selected content/form screens were checked at logical widths 320, 360 and 412, as well as all scenes at 390. This checks browser document/content width, not every possible native font size or Android/iOS layout.

## Rendering environment

Python Playwright, system Chromium (`/usr/bin/chromium`), self-contained content through `page.set_content`. No web server, API token or live backend was involved. Primary captures use 390×844 logical dimensions at device scale factor 2. The desktop review shell uses 1440×1000 at scale 2. Browser capture styles intentionally remove the preview device frame; native status bars must be handled separately.

The CSS font stack is Plus Jakarta Sans, Inter, Arial, sans-serif. Plus Jakarta Sans is not bundled or downloaded by this prototype. The local installed fallback is used in these screenshots. Native comparison must align font conditions or explicitly record expected rendering differences; no 100% native visual parity is claimed.

State transitions were settled or animations disabled for deterministic screenshots. Reduced-motion behavior was separately tested, not assumed from still images. Input records used in tests are fictional.

## Capture-run limitation

Two combined test/capture executions exceeded their execution time limits before all captures completed. The complete test suite was then run separately and passed, and screenshot exports were completed in independent batches with fresh pages. The interrupted attempts are not counted as completed captures or additional test passes. This is tooling evidence, not a performance benchmark of the native app.

## Not verified

Native Google login, SMS sending, push delivery, native map rendering, dialer launch, image upload, actual background location, device power-management behavior, keyboard-safe positioning on phones, hardware back behavior, true OS text scaling, screen-reader usability, hosted-origin theme persistence, secure cache policy, production tenant/role isolation, API uptime, atomic completion, payment correctness, OTP secrecy, approved-rider enforcement, server source parity, or saved mutations after native relaunch.

The local mock journey retains state only in the current page instance. It does not prove an assignment or delivery survives a backend refetch. Location and phone controls open descriptive preview sheets; they do not grant permissions or contact anyone.

## Production questions

Read section 13 of the main design specification before rollout. In particular, assigned-order serialization, mock-mode delivery verification and account-status enforcement need backend review; hiding fields/buttons in a native UI does not fix these concerns. Also verify existing location effect cleanup and the existing issue-report success path during implementation.

Raw evidence: `qa-results.json`, `contrast-checks.json`, `SCREENSHOTS.json`, `SOURCE_MANIFEST.json`.
