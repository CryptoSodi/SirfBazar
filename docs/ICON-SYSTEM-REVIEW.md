# UI icon refresh and merchant mobile signup review

Date: 8 October 2026. Branch: `codex/unified-icons-mobile-signup`.

## Scope

Customer, merchant and rider React Native/Expo apps; customer Next.js website;
merchant Vite dashboard/iPOS; admin Vite dashboard; standalone Vite POS.
UI icons now use Lucide. Existing brand logos, product photos, illustrations,
map-provider branding and framework-owned navigation assets are not replaced.
No API, database, production deployment, signing credentials or installed APKs changed.
The implementation is isolated from the original live-baseline checkout.

Repository conventions inspected: AGENTS.md/RTK.md, architecture, API contracts
and backend conventions. Styling continues to use each app's existing theme,
CSS classes and React Native styles; this is not a general redesign.

## Implementation

- Semantic `AppIcon` adapters in all apps; merchant `ReferenceIcon` and customer/rider
  compatibility adapters retain existing screen APIs. Static Lucide imports, stroke width 2.
- Emoji/text-symbol UI icons replaced across navigation, actions, status labels,
  catalogue fallbacks, ratings, pagination and categories.
- Native `IconLabel` keeps SVG outside React Native Text for wrapping/layout.
- Decorative web SVGs are hidden from assistive technology. Icon-only action names
  are retained or added; customer order-rating controls now expose numeric labels
  and selected state, with 44-pixel minimum targets.
- Category icons use an allowlist with a safe fallback for legacy stored values.
  Admins can select semantic icons without changing category IDs or product artwork.
- Merchant login now visibly offers sign up, requests the correct auth context,
  validates six-digit codes, supports OTP autofill/paste and resumes incomplete shop setup.
  Existing-account signup does not use a customer token to enter merchant tabs.
- The original WhatsApp OTP backend is unchanged. Google sign-in errors no longer
  silently trigger an alternate registration request.
- Lucide/Feather notices are retained in THIRD-PARTY-ICONS.md and dependency licenses.

## Interface coverage

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | SVG rendering tests; native wrappers; signup fields; rating controls; browser check for unnamed icon buttons | Decorative semantics and names checked. Native screen-reader/device behavior not verified. |
| Layout | Merchant/POS screenshots at 1440 and 390 pixels; native IconLabel layout and signup scroll container | Reviewed browser layout fits; SVG/text separation implemented. Native keyboard/font-scaling layout still needs device testing. |
| Writing | Signup mode, verification, account-context and delivery-unconfirmed copy | Explicit action labels; no promise of OTP delivery or automatic shop approval. |
| Typography | Library sizes/strokes; native Text separation; browser text/icon alignment | Consistent stroke weight and inherited type styles; no font replacement. |
| Colors | Theme-aware icon props/currentColor; merchant/POS light/dark screenshots | Existing palettes preserved; status meaning remains in text, not color alone. No full-app contrast audit claimed. |
| UI | Static named-library mapping, all alias render tests, category allowlist, screenshots | Consistent library glyphs; brand/product imagery preserved. |

No unresolved HIGH interface findings were identified in the inspected scope.
The interface skills influenced accessible labels, native SVG/text separation,
44/48-pixel targets on touched controls and the change-scoped visual review.

## Verification

Passed:

- `node node_modules/typescript/bin/tsc --noEmit` in all seven UI apps.
- `node scripts/test-icon-system.cjs`: 7 tests, covering every mapped web glyph,
  decorative semantics, meaningful merchant icon labels, web/native parity and category adapters.
- Merchant `npm test`: 7 auth-flow tests and 3 push lifecycle tests.
- Customer, rider, web checkout, standalone POS recovery, merchant iPOS, bulk import
  and order-alert regression suites.
- Customer website `npm run build`.
- Merchant, admin and standalone POS `node node_modules/vite/bin/vite.js build --configLoader native`.
  Native config loader used to avoid local Windows default-loader access failure.
- All three apps: `node node_modules/expo/bin/cli export --platform android --output-dir ../../output/icon-bundles/<app>`.
- Playwright CLI `run-code --filename scripts/check-icons-browser.cjs`: isolated
  mock API session, light/dark merchant/POS, icon-only button names and no page
  horizontal overflow at 390 pixels. CSS transitions finished before final screenshots.

Screenshots: `output/playwright/icons-ipos-light.png`, `icons-ipos-dark.png`,
`icons-ipos-390.png`. Browser checks do not perform real sales, account creation or OTP sends.

Not verified / release boundaries:

- Fresh APK compilation, installation, native rendering, TalkBack and live signup end-to-end.
  Android exports validate JS bundles, not native binaries or device behavior.
- Full visual journeys on customer web, admin and standalone POS; those have compile,
  adapter-render and relevant regression coverage, not exhaustive screenshot coverage.
- iOS build/device verification.
- Production rollout or backend compatibility testing against the other laptop.
- Local Node was 24.14.0; web/shop declare Node 22.x. CI/release must verify the declared runtime.
  Builds also report React 18 deprecation from Next and a merchant chunk-size warning.

## Maintaining the mapping

Edit `apps/shared/category-icons.ts`, run `node scripts/sync-category-icons.cjs`,
then run `node scripts/test-icon-system.cjs`. Generated per-app copies allow
standalone Next/Metro builds without requiring sibling-directory resolver changes.
New generic icons should be added consistently to all adapters; the parity test catches drift.
Use text labels for action meaning and accessible names for icon-only controls.

## Verdict

Approve the inspected source-level icon/signup changes. This is not production or
APK release approval: the device and release checks listed above remain outstanding.
