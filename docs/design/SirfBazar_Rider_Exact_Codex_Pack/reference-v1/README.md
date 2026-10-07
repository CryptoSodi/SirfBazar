# SirfBazar Rider — complete design pack

Start with **SirfBazar_Rider_Design.html** in a browser. No build, package installation, account or API token is needed to review it.

This is a source-mapped, interactive design for the **existing rider mobile application**, with Light, Dark and System. It does not run native code or connect to live production data.

## Review the design

On desktop use the left screen/state directory and right theme selector. On a narrow browser use the bottom design-only selector. Profile → Appearance changes themes inside the app composition.

The default Deliveries screen has a sample assigned order. Explore:

**View delivery → I’m at the shop → Check packed order → Confirm pickup → I’ve arrived → Confirm handover → Enter sample code and acknowledgements → Verify & complete.**

The prototype accepts any four digits for its isolated completion example. These are not real verification credentials. Phone-code examples do not send SMS. Call, maps, Google, permissions and support sheets explicitly preview hand-offs; they do not invoke live services. No application records are written to persistent storage; only the theme preference is attempted.

All stores, people, locations, prices and phone entries are fictional review data. The map is an illustrative drawing, not a geographic route. The native app must use verified map/address information instead.

## Files

| File | Purpose |
|---|---|
| `SirfBazar_Rider_Design.html` | Self-contained interactive design. |
| `RIDER_APP_OVERVIEW.png` | Four-screen visual overview, including dark mode. |
| `LIGHT_DARK_PREVIEW.png` | Full theme comparison. |
| `SIRFBAZAR_RIDER_APP_DESIGN.md` | Complete 26-screen/state design and workflow specification. |
| `API_CONTRACT_MAP.md` | Current rider/auth/joining routes, bodies and source limits. |
| `CODEX_IMPLEMENTATION_PROMPT.md` | Native implementation and exact-design instructions. |
| `STITCH_PROMPTS.md` | Seven batches for the existing Google Stitch environment. |
| `DESIGN.md` | Reusable design-system description. |
| `SCREEN_INDEX.md` | Screen reference IDs and links to exports. |
| `rider-design.css`, `rider-preview.js` | Exact browser source, separate for inspection. |
| `theme-tokens.ts`, `assets/` | Native-friendly token constants, original branding and exact icon paths. |
| `screens/` | 36 PNG reference captures; all 26 states, selected dark variants, sheet and review shell. |
| `QA_REPORT.md`, `qa-results.json`, `contrast-checks.json` | Actual local-preview checks, not native/live certification. |
| `SOURCE_MANIFEST.json` | Sources actually inspected and evidence scope. |
| `REFERENCE_LOCK.json` | Content hashes to keep this reference stable. |

The original logo/slogan SVGs were copied unchanged from the approved merchant v2 package. PNG light/dark derivatives are available for native image rendering. No font files are included. The reference requests Plus Jakarta Sans through its font stack and falls back to locally available Inter/Arial; it does not download a font.

## Use in Codex

Keep the pack together under an existing design/reference directory. Open the existing `apps/rider-app` workspace and give Codex the instruction below, together with the package:

```text
Read README.md, SIRFBAZAR_RIDER_APP_DESIGN.md, API_CONTRACT_MAP.md and
CODEX_IMPLEMENTATION_PROMPT.md from the SirfBazar_Rider_App_Design_v1 pack.

Reproduce this exact mobile design in my existing apps/rider-app using the
current backend in apps/api. Preserve Light, Dark and System, the provided
branding, native navigation and API-supported rider workflow. Do not create
another project or embed the HTML in a WebView. Inspect current contracts
and the existing session before implementing. Use the full saved prompt.
```

This snippet is for a later implementation request. The design deliverable itself made no repository changes, authenticated calls, live mutations or deployment.

## Reproduce local checks

The scripts require an existing Python environment with Playwright/Pillow and a compatible Chromium. They do not install dependencies automatically or connect to the production API. Review paths and use your existing browser tooling instead where appropriate.

```text
python tools/verify_reference.py
python tools/test_preview.py --tests-only
python tools/capture_screens.py 0 12
python tools/capture_screens.py 12 24
python tools/capture_screens.py 24 34
```

The last screenshot batch covers base screens and dark variants; the sheet and studio captures are existing additional references. Test the native app separately on real devices. Never replace original reference screenshots to conceal implementation differences.
