# Customer mobile reference: QA report

**Executed6 October 2026. Scope: local HTML design only.** No native app, live API, phone permissions, production session, checkout charge, delivery, source modification or store deployment was tested.

## Completed checks

**28 / 28 automated reference checks passed.** The suite rendered all 42 scenes in both themes (84 scene/theme render checks) and checked all 42 at320, 360 and 412logical widths. It also tested guest/Add behavior, second-shop preservation, address validation, explicit checkout sign-in, draft/code retention through theme changes, no auto-order after auth, final-review separation, local total snapshot, sign-in dismissal, invalid code, unpriced catalogue, search, issue validation, modal focus/Escape, System preference, reduced motion and uncertain-order/payment boundaries.

**28 / 28 selected solid-color contrast pairs** met the stated4.5:1text or3:1control/focus targets. This is a token-pair calculation, not full-page accessibility certification. Actual image surfaces, variable font metrics, disabled states, larger text and screen-reader use need native verification.

**84 screenshot references** were captured at390 × 844 logical, scale 2. All 42 scenes have light and dark stills. Selected Home light, multi-shop basket dark, final-review light, sign-in light and tracking dark captures were opened and visually inspected. Overview boards are composed from actual captures, not generated mock screenshots.

No JavaScript page exceptions and no network requests were observed in the completed preview test. The no-network finding is for this offline design run, not the native application's network behavior.

## Environment and test limits

Python Playwright and system Chromium; selfcontained HTML loaded with page.set_content. Captures use the reference's capture class to remove the desktop review frame. Reduced motion was selected for stable screenshots; its behavior was tested separately. The declared font stack is Plus Jakarta Sans/Inter/Arial/sans-serif. Browser platform-font inspection reported Inter/Inter-Bold for the hero; no remote fonts were fetched and no font binaries are in the package.

The first full test attempt stopped because a locator matched two legitimate sign-in close controls. The test selector was made explicit and the completed suite was rerun. The interrupted attempt is not counted as a passed run. No native parity score was computed.

## Not established by these tests

Native render/build performance, true OS safe-area handling, Android back, native keyboard, VoiceOver/TalkBack, OS font scaling, actual persistent storage, native Google cancellation/return, SMS/provider rates, live cart merge, exact price locking, order idempotency, payment-provider behavior, real push, maps/GPS, server authorization, backend deployment parity, customer↔merchant↔rider round trip and app-store acceptance.

The local sample basket/order state lives only in the current page. Some supporting actions acknowledge an example rather than persist a full record; its local success is never production evidence. The app implementation must use genuine API results and independently test those behaviors.

## Evidence files

- QA_RESULTS.json:28 test results.
- CONTRAST_RESULTS.json:28 calculated token pairs.
- reference/SCREENSHOTS.json:84 captures with logical dimensions and scale.
- native-handoff/LAYOUT_MEASUREMENTS.json:computed browser geometry and observed hero font.
- native-handoff/ASSET_PROVENANCE.json:18 inherited visual assets verified unchanged.
- SOURCE_MANIFEST.json:source/evidence boundaries.
- REFERENCE_LOCK.json:immutable design hashes.

Retests should write to a new output path, not overwrite this historical result and then imply it is a native pass.
