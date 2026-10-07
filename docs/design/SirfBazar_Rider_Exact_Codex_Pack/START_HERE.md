# SirfBazar Rider — exact-design Codex handoff

**Prepared:** 1 October 2026. **Reference:** supplied Rider design v1, unchanged.
**Task:** implement the selected design in the existing native rider application, not a new design.

## Owner's instruction

> Reproduce the rider application shown in the supplied HTML. Preserve the same layouts, assets, typography hierarchy, spacing, colors, Light/Dark/System themes and interactions. Connect the existing rider APIs. Do not substitute a similar template, a WebView or a new backend.

## Read order

1. Repository instructions and the owner's current implementation request.
2. `CODEX_RIDER_EXACT_PROMPT.md` — complete executable work brief.
3. `RIDER_EXACT_IMPLEMENTATION.md` — scope, visual locks, native adaptation and API boundaries.
4. `VISUAL_ACCEPTANCE.md` and `SCREEN_PARITY_MATRIX.md`.
5. `reference-v1/SirfBazar_Rider_Design.html`, `rider-design.css`, `theme-tokens.ts`, `assets/`, `screens/` and `SCREEN_INDEX.md`.
6. `reference-v1/SIRFBAZAR_RIDER_APP_DESIGN.md`, `API_CONTRACT_MAP.md`, `SOURCE_MANIFEST.json`, `QA_REPORT.md`.

The original screenshot/source bytes are authoritative for the selected visual treatment. Current verified backend contracts are authoritative for behavior and safety. Where they conflict, keep the composition and document the contract difference; do not fake success or silently redesign.

## Where this work goes

The previously identified rider workspace is `apps/rider-app`. Its backend is `apps/api` in `CryptoSodi/SirfBazar`. Confirm actual paths in the current checkout and preserve separate frontend/backend checkouts when that is how the owner works. Do not move projects to make paths match a document.

```dotenv
EXPO_PUBLIC_API_URL=https://api.sirfbazar.com/api
```

This is the native Expo client's variable, not `VITE_API_URL` or the customer website's `NEXT_PUBLIC_API_URL`. No credentials belong in this public setting.

## Start using the pack

Extract this folder under `docs/design/` in the existing project. Open Codex at that project's root. Paste `CODEX_RIDER_EXACT_PROMPT.md`, or use the pointer command in `COMMANDS.md`.

This package is not an app installer. It performs no API calls, authentication, SMS, production mutations, dependency installation, native build or deployment on its own.

## Important reference-tool boundary

`reference-v1/tools/` is retained unchanged as historical artifact source. Do **not** run its build/finalize/capture scripts against the original reference: some regenerate files and contain environment-specific paths. Use this pack's **top-level** `tools/verify_reference.py` and `tools/render_reference.py` instead. New captures go outside `reference-v1/`.

## Included

- Original HTML, full CSS, preview interaction source, source-matched theme tokens and original logos.
- All original 36 screenshots and 26 screen/state definitions.
- Exact icon geometry plus a generated native SVG adapter and portable SVG files.
- Screen coverage matrix, API guidance and local visual-test helpers.
- Implementation/contract/parity/deviation report templates.

No font binaries are included. Native font integration and device-specific rendering must be verified in the actual application.
