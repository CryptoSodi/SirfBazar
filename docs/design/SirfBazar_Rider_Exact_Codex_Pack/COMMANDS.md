# Commands — share with the existing Codex workspace

## Recommended: editor or desktop Codex

Extract the complete ZIP under `docs/design/`, keep the folder name `SirfBazar_Rider_Exact_Codex_Pack`, and open your existing project in Codex. Paste the full `CODEX_RIDER_EXACT_PROMPT.md` or this pointer:

```text
Read docs/design/SirfBazar_Rider_Exact_Codex_Pack/START_HERE.md and
CODEX_RIDER_EXACT_PROMPT.md in that same folder. This is an implementation
request. Reproduce the supplied Rider v1 design in my existing native
apps/rider-app, including all 26 states and Light/Dark/System, and connect
the existing rider APIs. Execute the complete handoff, not just a plan.
Do not redesign, create another app/backend or embed the HTML in a WebView.
Do not perform live production mutations without approved test scope.
```

The original API log shows `C:\repos\SirfBazar\apps\api`, but it does not establish the current frontend machine path. The commands below use `C:\repos\SirfBazar` as an **editable example**, not an inspected current path.

## Optional Windows PowerShell extraction and CLI start

The ZIP must already be downloaded. Set the first two paths to the actual locations. The commands avoid overwriting an existing pack.

```powershell
$Repo = 'C:\repos\SirfBazar'
$Zip = Join-Path $HOME 'Downloads\SirfBazar_Rider_Exact_Codex_Pack.zip'
if (-not (Test-Path -LiteralPath $Repo -PathType Container)) { throw "Project not found: $Repo" }
if (-not (Test-Path -LiteralPath $Zip -PathType Leaf)) { throw "Downloaded ZIP not found: $Zip" }
Set-Location -LiteralPath $Repo
$DesignDir = Join-Path $Repo 'docs\design'
$Pack = Join-Path $DesignDir 'SirfBazar_Rider_Exact_Codex_Pack'
if (Test-Path -LiteralPath $Pack) { throw 'Pack already exists. Inspect it before replacing any files.' }
New-Item -ItemType Directory -Path $DesignDir -Force | Out-Null
Expand-Archive -LiteralPath $Zip -DestinationPath $DesignDir
if (-not (Test-Path -LiteralPath (Join-Path $Pack 'START_HERE.md'))) { throw 'Unexpected extraction structure.' }
Get-Command codex -ErrorAction Stop | Out-Null
codex 'Read docs/design/SirfBazar_Rider_Exact_Codex_Pack/START_HERE.md and CODEX_RIDER_EXACT_PROMPT.md in that folder. Execute the full exact Rider v1 native implementation handoff in my existing rider app. Do not redesign or use a WebView. Connect existing APIs; live production test mutations need approved scope.'
```

This opens the already installed Codex CLI with an initial instruction. It does not install Codex or use auto-approval/dangerous-mode flags. An editor user can skip the CLI entirely and paste the full prompt.

## Reference checks from the project root

```powershell
python .\docs\design\SirfBazar_Rider_Exact_Codex_Pack\tools\verify_reference.py
```

Use the existing `python`/`python3`/`py` executable actually installed. The verifier uses only the Python standard library.

## Offline HTML capture and comparison (optional tools)

These helpers require the existing Python Playwright/browser and Pillow tooling respectively. Do not install tool dependencies into the application package or replace its package manager just to run them. The coding agent can use its already configured browser/native testing tools instead.

```powershell
python .\docs\design\SirfBazar_Rider_Exact_Codex_Pack\tools\render_reference.py --screen home --theme light --out .\artifacts\rider-reference
python .\docs\design\SirfBazar_Rider_Exact_Codex_Pack\tools\render_reference.py --screen code --theme dark --out .\artifacts\rider-reference
python .\docs\design\SirfBazar_Rider_Exact_Codex_Pack\tools\compare_screens.py --reference .\artifacts\rider-reference\home-light.png --actual .\artifacts\rider-native\home-light.png --out .\artifacts\rider-comparison\home-light
```

`--chromium` can name an already installed Chromium executable for reference capture. Capture is local, blocks network requests and writes to a separate directory. Do not point output at `reference-v1/`. The comparison requires images already normalized under the declared native/reference conditions and never silently resizes them.

## Native start/build is a separate step

After Codex inspects the package scripts and compatible native dependencies, use that project's development-build workflow. The original source uses Expo, but no SDK upgrade or new project is needed simply because a design changed. Existing development builds normally use `npx expo start`; native-module/config changes can require rebuilding. Do not run `prebuild --clean`, cloud release or publishing commands automatically. The actual native build/toolchain state is not verified by this handoff.
