# Native handoff helpers — not a new app

`RiderReferenceIcon.tsx` converts all 34 original `assets/icons.json` fragments into React Native SVG primitives without changing their path/shape geometry. It requires the project's compatible `react-native-svg` support. The adapter is generated handoff code, not tested native application code. Inspect installed dependencies before adopting it; no automatic installation or SDK change is implied.

`icons/` contains the same fragments wrapped in standalone SVGs. The full original logos and light/dark PNG derivatives remain in `../reference-v1/assets/`.

`reference-theme-tokens.ts` is byte-identical to the original theme-token source. Integrate into the actual provider; it is not a provider or complete StyleSheet. Hyphenated token keys are valid object keys, not native style property names.

Use the exact glyph/color/size at each reference site. Default is 22 logical units and stroke 1.7, but note badges, tabs, success glyphs and larger empty states override size/weight in CSS. Provide accessibility names on the parent control or explicitly on an informative icon, avoiding duplicated announcements.

Do not import browser CSS/JS into native source. Translate the layout and text cascade deliberately. The screenshot capture tools can record computed source geometry to help this work.
