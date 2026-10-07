# Native visual comparison report

Verification date: 2026-10-06. Reference: `docs/design/SirfBazar_Customer_Mobile_Exact_Design_v1` at the repository root. This report accompanies [screen-status.md](screen-status.md), [api-status.md](api-status.md), and [design-deviations.md](design-deviations.md).

The 42 reference compositions are mapped to native React Native screens or data-driven states. Shared tokens, reference SVG icons, branding, spacing, cards, headers, tabs, and action docks have been implemented. **Exact native visual parity is not approved.** No physical-device/emulator captures, native overlays, or 84-scene light/dark comparison set were produced in this environment. Browser captures below exercise React Native Web with fictional local data; they are neither the original reference preview nor evidence of native rendering.

## Final verification

| Check | Result | Scope |
|---|---|---|
| Customer tests | 44 passed, 0 failed | Actual helpers/components tested by the four customer test files; in-process test mode avoids sandbox child-process restrictions. |
| TypeScript | Passed | Full customer app `tsc --noEmit`. |
| Scoped diff whitespace check | Passed | `git diff --check -- apps/customer-app`; unrelated working-tree changes left intact. |
| Reference lock | 116 of 116 passed | Original verifier checked byte lengths and SHA-256 against `REFERENCE_LOCK.json`; reference inputs unchanged. |
| Android JavaScript/assets export | Passed | Hermes bundle `index-42cbb9d60721318c8798e92f3a413328.hbc`, 3,267,331 bytes. |
| iOS JavaScript/assets export | Passed | Hermes bundle `index-6ec741f29ffda3323f1bc14011d2200d.hbc`, 3,256,476 bytes. |
| Export completeness | Passed | `output/customer-native-exact`: 28 assets, two bundles and `metadata.json`; all metadata-referenced assets exist. |
| Native install and provider integration | Not verified | Exports are not APK/IPA builds, installed apps, signing checks, SMS/Google/push tests, or payment verification. |

Both exported bundles deliberately contain `http://localhost:3198/api`, the isolated fixture URL. **Do not ship these QA exports or use localhost as a physical device's production endpoint.** No deployment, schema migration, production seed, or live customer mutation was performed.

Commands run from `apps/customer-app`, except the reference verifier and diff check, which run from the repository root:

```powershell
rtk proxy node --experimental-test-isolation=none --test test/customer-flow.test.cjs test/checkout-draft.test.cjs test/customer-reference.test.cjs test/product-purchase.test.cjs
rtk proxy npx.cmd tsc --noEmit
rtk git diff --check -- apps/customer-app
rtk proxy python docs/design/SirfBazar_Customer_Mobile_Exact_Design_v1/tools/verify_reference.py
```

## Browser comparison evidence

The browser exercised the app on port 8085 against `test/mobile-fixture.cjs` on port 3198. Data, OTP, orders, names and images in these runs are fictional test fixtures. Default capture size was 390 × 844 CSS pixels; this is not a simulated device status bar or a native screenshot. Reference PNGs are 780 × 1688, representing 390 × 844 at 2×. The native app uses the actual OS safe area, not a painted 9:41/status strip.

No bundled Inter/Plus Jakarta Sans font was supplied by the reference pack or installed in the app. The current system fallback changes glyph metrics and wraps; exact font parity remains open. No numeric image-diff score is asserted.

| Scene/theme | Device/logical size/scale | Font | Expected | Actual | Overlay/diff | Remaining difference |
|---|---|---|---|---|---|---|
| C01 Home, light | Browser 390 × 844, not native | System fallback | Public browse-first hierarchy; products before shops | [Capture](../../output/playwright/customer-exact-home-light.png) | Not produced | Fixture content, system font, no fake OS bar; native spacing and scrolling unverified. |
| C09 Basket, light | Browser 390 × 844 | System fallback | Shop grouping, genuine charges, checkout dock | [Capture](../../output/playwright/customer-exact-basket-light.png) | Not produced | One fixture shop; native multi-shop and long-content parity unverified. |
| C11 Delivery, light | Browser 390 × 844 | System fallback | Delivery draft before authentication | [Capture](../../output/playwright/customer-exact-delivery-light.png) | Not produced | Native keyboard/back and process-death behavior unverified. |
| C14 Sign-in, light | Browser 390 × 844 | System fallback | Deliberate sign-in sheet after delivery entry | [Capture](../../output/playwright/customer-exact-signin-light.png) | Not produced | Fixture OTP only; no real Google/SMS/native sheet proof. |
| C15 Verify phone, light | Browser 390 × 844 | System fallback | Code entry and recoverable invalid-code feedback | [Capture](../../output/playwright/customer-exact-otp-light.png) | Not produced | Provider, keyboard and autofill remain unverified. |
| C16 Merge review, light | Browser 390 × 844 | System fallback | Explicit basket review after merge | [Capture](../../output/playwright/customer-exact-merge-review-light.png) | Not produced | Isolated merge only; no live concurrency certificate. |
| C17 Final review, light | Browser 390 × 844 | System fallback | Address, charges, COD, explicit Place order | [Capture](../../output/playwright/customer-exact-final-review-light.png) | Not produced | Server accepted-quote contract remains a release blocker. |
| C19 Tracking, light | Browser 390 × 844 | System fallback | Genuine saved status and freshness | [Capture](../../output/playwright/customer-exact-tracking-light.png) | Not produced | Fixture recovery record lacks full address/timeline; rider map is unavailable, not simulated. |
| C27 Appearance, light/dark | Browser 390 × 844 | System fallback | Three choices and persistent basket/draft | [Light](../../output/playwright/customer-exact-appearance-light.png), [dark](../../output/playwright/customer-exact-appearance-dark.png) | Not produced | Browser System color-scheme tested; native OS change/relaunch not verified. |
| C28 Help, light | Browser 390 × 844; also 320 and 430 wide | System fallback | Three help entries and two explanatory sections | [390](../../output/playwright/customer-exact-help-light.png), [320](../../output/playwright/customer-exact-help-320-light.png), [430](../../output/playwright/customer-exact-help-430-light.png) | Not produced | No horizontal document overflow at 320/430; this does not certify all screens or native accessibility. |
| C29 form composition, account-help variant, light | Browser 390 × 844 | System fallback | Issue/title/details, submission disclosure and fixed action | [Capture](../../output/playwright/customer-exact-support-form-light.png) | Not produced | Account-help context rather than an order-specific report. No ticket submitted; native keyboard unverified. |
| C30 Replacement, light | Browser 390 × 844 | System fallback | Explicit original/proposed comparison and two choices | [Capture](../../output/playwright/customer-exact-replacement-light.png) | Not produced | Missing fixture unit prices/images are disclosed honestly; no acceptance/decline was sent. |
| C32 Empty basket, light | Browser 390 × 844 | System fallback | Confirmed empty state, shopping actions and tabs | [Capture](../../output/playwright/customer-exact-empty-light.png) | Not produced | Native safe areas and text scaling unverified. |
| C37 Changed price, light | Browser 390 × 844 | System fallback | Review actual changes before placement | [Capture](../../output/playwright/customer-exact-changes-light.png) | Not produced | Expanded current-charge summary is intentional; atomic quote guarantee still absent. |
| C39 Uncertain result, light | Browser 390 × 844 | System fallback | Check status before another placement | [Initial](../../output/playwright/customer-exact-uncertain-light.png), [after reload](../../output/playwright/customer-exact-uncertain-reloaded-light.png) | Not produced | Additional history/support recovery links; native process restart not tested. |
| C42 Merge not confirmed, light | Browser 390 × 844 | System fallback | Retain guest items/draft; do not place yet | [Capture](../../output/playwright/customer-exact-merge-error-light.png) | Not produced | Shows pending guest-only totals, explicitly not a confirmed combined account total. |
| Remaining scenes and theme/device combinations | Not captured natively | Not verified | Full locked C01–C42 reference set | See [screen map](screen-status.md) | Not produced | Source mapping is not a screenshot pass. No dark/native pass inferred from shared tokens. |

Visual spot review covered home, basket, sign-in, appearance dark, final review, changed price, uncertain recovery, merge failure, replacement, compact Help and the account-help form. Other listed captures are retained as functional-run evidence, not exhaustive visual approval. Final browser observations recorded zero console errors and three warnings; React Native Web dependency/focus warnings are not native accessibility certification. The temporary verification browser and servers on ports 8085/3198 were stopped after capture; the evidence files remain saved.

## Isolated functional results

| Scenario | Observed outcome |
|---|---|
| Public shopping | Catalogue and basket available without authentication or fabricated coordinates. |
| Delivery before authentication | Address/contact/instructions and explicitly entered pin retained in the local draft. Browser map fallback requires explicit coordinates; native map not exercised. |
| OTP | Invalid fixture code produced an inline error. Correct fixture code signed in; neither action placed an order. |
| Failed merge and reload | Guest quantity remained one, account quantity zero, order POST/creation counts zero. After reload, empty-account recovery entry reopened C42 with the retained guest quote instead of a zero account total. |
| Merge recovery | Explicit saved-basket check reconciled one guest item into the account basket. Separate merge/final review steps still produced zero order POSTs. |
| Appearance | Light/Dark changed the UI; System followed browser-emulated dark preference. Serialized checkout draft was unchanged across the switches. |
| Changed price | Quote changed from Rs 395 to Rs 410; C37 required explicit acknowledgment with zero placement POSTs at that checkpoint. |
| Lost placement response | One deliberate Place action produced C39. Fixture counted two HTTP POST attempts and one created order under the same request ID. Cause of the second transport attempt was not established; application transport audit found no automatic status-0 retry. |
| Reload after uncertain result | Basket recovery entry restored C39. Status check found the saved order and opened tracking; counts remained two POST attempts and one creation. Recovery did not POST another order. |
| Replacement view | Actual fixture proposal opened without any accept/decline write. Missing unit-price/image fields showed unavailable states rather than invented values. |
| Help navigation | Account → Help opened correctly; compact/wide browser checks found document widths exactly 320/430 respectively. No support ticket was submitted. |

The fixture is not a substitute for the server: its saved-order amount after a forced price change remains a simplified fixed test snapshot, and some recovered-order fields are intentionally incomplete. Use it for control-flow/counter assertions, not financial-contract correctness. Do not infer that production can guarantee reviewed prices or enforce restricted-product policy from these results.

## Native acceptance still required

Capture C01–C42 in both themes on the intended Android/iOS devices and compare at the reference logical viewport, accounting for real system bars. Resolve the font asset/license and review glyph metrics before claiming exactness. Test compact/large phones, long real content, keyboard overlap, hardware/gesture back, safe areas, large text, TalkBack/VoiceOver, focus, reduced motion, denied location, offline/reconnect, account switches and process death. Use approved test accounts for provider and mutation tests. Close both backend release blockers in [api-status.md](api-status.md) before treating checkout as production-ready.
