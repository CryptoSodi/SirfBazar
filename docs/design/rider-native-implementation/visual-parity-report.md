# Native visual comparison report — 2026-10-01

Reference integrity: the pack's top-level verifier passed for all **69 original reference files**, unchanged. Reference viewport is 390 × 844 logical at 2× capture scale. Source pack is `../SirfBazar_Rider_Exact_Codex_Pack/`. Working-tree base commit: `ca4188c`.

Native build/device/OS: no installable native build or device capture. `adb devices` returned an empty device list; no Android emulator/AVD was available. Logical window, physical screenshot size, pixel ratio, font family/rasterization/scale, system preference, locale, scroll position, keyboard, and animations could therefore not be measured. An Android Expo/Hermes export succeeded, but it is a JavaScript bundle, not native rendering evidence. There are **no actual native screenshots or overlays**. No exact parity claim is made.

| State/theme | Original | Actual native screenshot | Overlay/diff | Result |
|---|---|---|---|---|
| R01–R26 Light | Pack `reference-v1/screens/` files listed in matrix | Not captured | Not produced | Implemented in source; native visual verification pending |
| R01/R03/R04/R06/R07/R12/R13/R15 Dark | Corresponding pack screenshots | Not captured | Not produced | Native visual verification pending |
| Remaining dark states | HTML/CSS/theme tokens, no supplied PNG | Not captured | Not produced | Native visual verification pending |
| Pickup sheet | `35-pickup-confirmation-sheet.png` | Not captured | Not produced | Native visual verification pending |

Static interface review scope: new rider routes/components and reference images, with a focused delivery-workflow review. Coverage was source-only for layout, copy, theme tokens, accessibility semantics, and payment/status boundaries; it did not inspect native pixels or screen-reader output. The flat destination placeholder was corrected to vector street/route artwork matching the reference hierarchy, with a persistent “Illustrative map · not live GPS” label. Main actions use at least 44-dp touch areas, headings expose header semantics, navigation tabs expose selected state, and cash and sign-in/delivery codes use distinct copy. These are source observations, not measured device results.

Open findings before a parity verdict:

1. **Block release — no native capture/comparison.** Install on an Android device/emulator (and iOS device/simulator for iOS scope), record matched Light/Dark/System state at 390 × 844 logical or explicitly normalize screenshots, compare every R state, then correct spacing/type/safe-area differences. Preserve uncropped originals and note any system-region crops.
2. **Block release — backend secret/config audit.** The assigned-orders API appears to serialize `deliveryOtp`; the server must exclude it. Verify production does not enable the mock delivery-code bypass. Client rendering suppression is not sufficient.
3. **Not verified — actual font weight and text scaling.** Reference uses weight 750; the native source uses available `700`. Capture and document any mismatch, especially at large text.
4. **Not verified — dark, keyboard, interruption and accessibility.** Test theme switch without losing the selected order, entered codes/notes/checks, scroll or pending requests; test Android back, TalkBack/VoiceOver, and keyboard/dock occlusion.
5. **Intentional source difference — GPS.** The illustrative map is not a computed route. Live location transmission was not enabled because it requires separate approval and device/privacy testing.

Tests actually run: `npm run typecheck` passed; `npx expo export --platform android` passed into `output/rider-exact-android-export-v2`; reference hash verification passed. No component/integration/native screenshot test was available or run. No production API call or mutation was executed.

Verdict: **source implementation substantially covers the pack, but native visual parity and production readiness are not verified.**
