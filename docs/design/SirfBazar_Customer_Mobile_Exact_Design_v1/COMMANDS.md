# Giving this package to Codex

Use your existing Codex setup and actual project root. This package does not install Codex, create repositories, mutate the API or run an app automatically. Native build commands below are local development operations, not publishing commands.

## 1. Extract inside the existing project

The ZIP has one top-level folder: `SirfBazar_Customer_Mobile_Exact_Design_v1`.

From your actual SirfBazar repository root in Windows PowerShell:

```powershell
$archive = Join-Path $HOME 'Downloads/SirfBazar_Customer_Mobile_Exact_Design_v1.zip'
$destination = Join-Path (Get-Location) 'docs/design'
$pack = Join-Path $destination 'SirfBazar_Customer_Mobile_Exact_Design_v1'
if (-not (Test-Path -LiteralPath $archive)) { throw 'Locate the downloaded ZIP and set $archive to its actual path.' }
if (Test-Path -LiteralPath $pack) { throw 'This pack folder already exists. Compare versions rather than overwrite it.' }
New-Item -ItemType Directory -Force -Path $destination | Out-Null
Expand-Archive -LiteralPath $archive -DestinationPath $destination
```

For another OS, extract manually to the same relative `docs/design/` directory. Do not move apps/api into the customer frontend.

## 2. Open the HTML

```powershell
Start-Process (Join-Path $pack 'reference/SirfBazar_Customer_Mobile.html')
```

Use its scene/theme controls. This local preview never talks to production. Native implementation must not embed it in a WebView.

## 3. Start Codex in the project, not inside the preview folder

Paste the entire `CODEX_CUSTOMER_EXACT_PROMPT.md` into the existing Codex editor session. Or start the existing CLI with an initial instruction:

```powershell
codex "Read docs/design/SirfBazar_Customer_Mobile_Exact_Design_v1/START_HERE.md and CODEX_CUSTOMER_EXACT_PROMPT.md in that folder. Execute the complete exact native customer-app implementation handoff in the existing apps/customer-app. Preserve completed merchant and rider apps. Do not redesign, use a WebView or create another backend. Connect existing APIs; production test mutations require approved records and scope."
```

The complete instructions stay in the file, so the short launch command is not the only context. Do not add auto-approval, sandbox-bypass, destructive reset or publishing flags. CLI initial-prompt usage was checked in official OpenAI documentation [W1 in SOURCE_MANIFEST.json].

## 4. Configuration for native customer app

Ask Codex to inspect current environment handling and safely update the existing app's config, preserving unrelated values:

```dotenv
EXPO_PUBLIC_API_URL=https://api.sirfbazar.com/api
```

Do not put secrets, tokens, passwords, database URLs or private Google secrets in EXPO_PUBLIC_* variables. Use this native key, not website NEXT_PUBLIC_API_URL or merchant VITE_API_URL.

## 5. Reference-integrity and optional preview tests

These are local tools with no network/API tests:

```powershell
python docs/design/SirfBazar_Customer_Mobile_Exact_Design_v1/tools/verify_reference.py
```

When the machine already has Python Playwright and Chromium, optional captures go to a separate output directory:

```powershell
python docs/design/SirfBazar_Customer_Mobile_Exact_Design_v1/tools/capture_reference.py --out ./customer-reference-captures --theme both
```

If Chromium is not on PATH, set CHROMIUM_PATH to its actual executable. The tools do not install Python/browser packages. These captures are **HTML references**, not screenshots of the native app. Never run them against production URLs or replace the original expected screenshots.

Optional reference QA writes to a separate output file:

```powershell
python docs/design/SirfBazar_Customer_Mobile_Exact_Design_v1/tools/test_preview.py --out ./customer-preview-retest.json
```

## 6. After Codex implements the native app

Confirm the actual existing package scripts. The inspected package supports:

```powershell
Push-Location apps/customer-app
npm run typecheck
npx expo start --dev-client
Pop-Location
```

The development server is interactive; stop it before the final Pop-Location as needed. Use the already installed compatible dependencies. Only run `npm ci` when necessary and consistent with the actual package-lock/worktree; do not install every workspace or upgrade Expo just for styling.

A custom development build is needed for the configured native modules that Expo Go does not provide. Reuse your established Android/iOS development-build process; do not trigger a clean prebuild, release signing, cloud build or app-store submission without its own authorization. [W2]

## 7. Evidence to request

Require actual native Light/Dark screenshots and explicit API test evidence, not another screenshot of this HTML. Use approved test records for order placement and verify the same order through merchant and rider apps without modifying those apps. Confirm the reference's private-code masking, final-review rule and no automatic development payment confirmation are preserved.
