# Android Launcher Icons

Approved for integration by the owner on 9 October 2026 after creation in the
icon-design chat `01a094c4-7348-79f3-9b5b-13a6013430db`.

| App | Symbol | Package |
| --- | --- | --- |
| Customer | Original shopping basket | `pk.sirfbazar.customer` |
| Merchant | Storefront with basket emblem | `pk.sirfbazar.merchant` |
| Rider | Delivery scooter with basket emblem | `pk.sirfbazar.rider` |

Each app keeps its files in `assets/brand/app-icons/<role>/`: the 1024px legacy
PNG, transparent adaptive foreground, opaque #009966 background, monochrome
alpha silhouette, 512px store artwork and editable SVG masters. These are exact
copies of the delivered kit, not regenerated artwork. The source kit is named
`sirfbazar-app-icons-2026-10-09`; it was exported in that chat's visualization
folder. The original basket source is `assets/brand/sirfbazar-app-icon-green.svg`
(SHA-256 `5017db90d8b9220940e1aa7dd129853a71f945fef1e5c4675bd6cda4b07b0e3c`).

Only `expo.android.icon` and `expo.android.adaptiveIcon` are changed in each
`app.json`. Dynamic configs retain those fields. Top-level icons, splash
screens, iOS, in-app brand components, permissions, API settings, Google IDs,
package IDs and release signing identities are unchanged.

## Checks

Run `rtk node scripts/test-android-launcher-icons.cjs` with the existing web and
native dependencies installed. Checks cover resolved Expo configuration,
role-specific files, dimensions, opacity, exact background colour, original
basket geometry, matching monochrome alpha, distinct symbols and adaptive safe
area including a 3dp shift. No new dependency is needed: the test uses the web
app's existing Sharp package.

Review the delivered circle/squircle and 64/48/32px previews and light/dark
monochrome variants. Themed icon selection is controlled by the launcher. No
rounded mask is baked into the masters. Pixel checks and exported previews do
not replace an installed-device launcher check.

The repository-requested `better-interface` and focused `better-*` skills were
not available during integration. Review uses BRANDING.md, the existing frontend
guidelines and [Expo SDK 54 icon configuration](https://docs.expo.dev/versions/v54.0.0/config/app/).

## Building And Rollback

Use the existing `release-keystore` EAS profiles and signing helper documented in
[Android release keys](../android-release-keys.md). Increase the remote Android
version code before a new build, retain version 1.0.0 and the approved keys, and
verify the resulting APK signatures, packages and compiled icon resources.
The profiles target the existing production API; this icon change does not
deploy or modify that API. Do not publish to Google Play as part of this task.
The [verified build 3 report](../production-readiness/ANDROID_ICONS_BUILD3_2026-10-09.md)
records the completed APKs and compiled-resource checks.

To roll back the artwork, remove only the new Android icon fields so the
unchanged top-level basket becomes the fallback, then rebuild with a higher
version code and the same signer. Never uninstall or rotate a key merely to
roll back an icon. Older APKs signed with other keys still require an explicit
data-loss decision before replacement.
