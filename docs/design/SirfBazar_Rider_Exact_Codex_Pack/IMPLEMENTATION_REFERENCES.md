# Source basis and supplementary tool references

## Primary basis — unchanged supplied files

`reference-v1/SIRFBAZAR_RIDER_APP_DESIGN.md`, `API_CONTRACT_MAP.md`, `SCREEN_INDEX.md`, `SirfBazar_Rider_Design.html`, `rider-design.css`, `theme-tokens.ts`, `assets/`, `screens/`, `SOURCE_MANIFEST.json`, `QA_REPORT.md` and the included owner-supplied startup log.

The original source-register/API review is retained as it was. The current handoff does not assert that the deployed backend has the same commit, providers, security or DTOs. Reinspect current code/contracts when implementing.

## Supplementary technical references checked 1 October 2026

These describe tools, not new SirfBazar behavior. Follow the installed versions; do not infer an upgrade requirement.

- React Native Style: https://reactnative.dev/docs/style
- React Native Height and Width: https://reactnative.dev/docs/height-and-width
- Expo development builds: https://docs.expo.dev/develop/development-builds/introduction/
- Expo using development builds: https://docs.expo.dev/develop/development-builds/use-development-builds/
- Codex CLI command reference: https://developers.openai.com/codex/cli/reference/

The CLI reference confirms that `codex` can receive an initial prompt. This package uses ordinary interactive invocation, not an approval/sandbox bypass. The start command requires the user's existing CLI installation/session. No installation is requested by the handoff itself.

No background-tracking guarantee or production integration follows from installing a package. Native build availability, signed configuration and hardware behavior must be tested separately.
