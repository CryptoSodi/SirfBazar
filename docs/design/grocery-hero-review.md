# Grocery homepage hero — implementation and interface review

## Dark-mode correction — supersedes the original pale-island decision below

9 October 2026. The owner reported that the hero still looked light in dark mode.
Scope: existing customer homepage hero CSS and its local-only browser regression.
No artwork, copy, routes, backend, dependencies or other apps changed.

| Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- |
| MEDIUM, resolved | Colors | apps/web/components/GroceryHero.module.css:1 | Fixed pale surface/ink and forced light color scheme in every theme | Existing data-theme dark tokens for surface, ink, muted, action, mint and focus; distinct filled CTA foreground; inset unchanged artwork | Selected appearance must apply to the hero, not just the page around it |

Coverage: accessibility (computed text/control contrast, keyboard order, focus,
reduced motion, 320px/200% text); layout (eight widths, complete image ratio);
writing (unchanged labels and destinations verified); typography (wrapping and
font checks); colors (rendered Light/Dark and System); UI polish (desktop/mobile
visual inspection and theme switching). No remaining actionable hero findings.
The original opaque artwork remains pale inside its own rounded frame in dark
mode, unfiltered and unmodified; the hero itself is now dark.

Actual checks: 16/16 customer-web tests; normal Next production build including
TypeScript; git diff --check; local production website on port 5222 with the
committed Playwright CLI fixture: **88 checks passed**. Screenshots refreshed at
1672, 1440, 1366, 1024, 768, 390, 360 and 320px in both themes, under the filenames
listed below. System changes now assert the actual hero surface, not only html.

Measured dark text ratios: heading 14.86:1, description 8.73:1, primary CTA
11.14:1, secondary CTA 9.92:1. Light ratios unchanged and all checked pairs meet
4.5:1. All browser API calls intercepted; no real OTP/orders/data writes.
Not verified: screen-reader devices, physical phone and actual toolbar zoom.
The interface skills guided reuse of the shared semantic palette and contrast
checks instead of recoloring the supplied artwork. **Approve** in this scope.

## Original release record

9 October 2026. Scope: the existing customer website homepage hero, Next.js
16.4 / React 18 / TypeScript, existing Plus Jakarta Sans and Lucide icons.
CSS Modules keep the new presentation off checkout, search and other apps.
Repository instructions, architecture, API contract, deployment/consolidation
records and current source were inspected. Existing records contain historical
claims; the current client/routes and executed checks are authoritative here.

## Files

- `apps/web/app/page.tsx`: replace only the old hero; pass real resolved location state.
- `apps/web/components/GroceryHero.tsx`: semantic headline, copy, native navigation
  links, four benefit items and one Next Image. No API/auth/basket handlers.
- `apps/web/components/GroceryHero.module.css`: isolated responsive hero and focus,
  reduced-motion and forced-colors treatments.
- `apps/web/public/images/hero/grocery-hero-artwork.webp`: supplied opaque
  809 × 644 WebP, 87,306 bytes. PNG and 480px variant not shipped: Next's responsive
  image pipeline downsizes the single source rather than preloading extra variants.
- `apps/web/test/grocery-hero.test.cjs`: three component contract regressions.
- `apps/web/test/grocery-hero.browser.js`: reusable local-only Playwright CLI fixture;
  all API calls intercepted, including simulated guest-cart writes.
- This review and `grocery-hero-interactions.md`.

## Deliberate reference adjustments

- Retain the actual shared 1280px site container instead of changing all pages to
  the mockup's 1560px panel. At 1672 × 941 the hero is 1280 × 562px with a 56px
  headline and a 666 × 530px complete illustration, rather than literal mockup geometry.
- Keep the real header, approved vector wordmark, search, categories, account,
  orders, appearance and basket; no Wapda Town or decorative basket count.
- Use “from local shops” until a non-example location resolves, then “from shops
  near you.” The header continues to show the actual selected area/pin.
- Safer supporting copy: “Shop everyday essentials from local stores. They prepare
  your order and deliver it to your door.” Benefits: Local shops / Shop-managed
  delivery / Everyday groceries / Clear order total. No speed, freshness, pricing,
  quality or universal payment promises. No added leaf brand or duplicate badge.
- Phone and dark treatments are adaptations, not matches to nonexistent supplied
  references. Dark retains a pale mint hero with dark copy and unchanged artwork.
  At 320–390px artwork is contained at 180–221px high; actions precede decoration.
- No entrance animation: content and shopping actions are immediately available.
- The requested extracted pack, README.md, ASSET_GUIDE.md and SOURCE_MANIFEST.json
  were absent from the checkout/Downloads. The owner-supplied CODEX_PROMPT.md,
  SIRFBAZAR_GROCERY_HERO_CODEX.md and all five supplied images were used. No claim
  of reading absent files or matching an unavailable source manifest.

## Scope and coverage

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Real links/headings/list; browser keyboard order and focus; reduced motion; 320px plus 200% text; image failure | Clear in hero scope; no screen-reader device audit claimed |
| Layout | Actual production-rendered homepage at eight widths in two themes; full mobile scroll captures; artwork ratio measured | Clear |
| Writing | Every hero label, real destinations, default vs confirmed location; unsupported claims removed | Clear |
| Typography | Loaded Plus Jakarta Sans 800, fluid heading, wrapping, enlarged text and readable labels | Clear |
| Colors | Computed foreground/background in Light and Dark; WCAG luminance calculation below | Clear |
| UI polish | Reference comparison, native icon family, CTA hierarchy, intentional pale island, no image recoloring or blocking animation | Clear |

No actionable interface findings remain in the hero scope. During visual iteration,
the phone benefit row was compacted, the narrow-tablet split rebalanced and the
200%-text long-word overflow corrected. The design skills guided these fixes.

Measured pairs in **both themes** (hero background `#eef7f0`): heading `#071f18`
15.76:1; secondary copy `#52665c` 5.62:1; accent `#007a52` 4.92:1; white on
primary green 5.38:1; focus `#4762cc` on mint 4.94:1. All meet the relevant
WCAG AA text/focus targets checked here. This is not a whole-site conformance audit.

## Checks actually run

Using Node 22.23.3 in `apps/web`:

- `node --test test/*.test.cjs`: **16/16 passed**, including three new hero tests.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node node_modules/next/dist/bin/next build`: passed (normal Turbopack build).
- `git diff --check`: passed; only a Git Windows line-ending notice.
- Production build served locally with `next start --port 5221 --hostname 127.0.0.1`.
- Playwright CLI `run-code --filename apps/web/test/grocery-hero.browser.js`:
  **54 checks passed** against that actual website, with intercepted API responses.
  Home opens without forced login/location; real picker saves GPS-selected pin;
  guest Add updates header basket; both CTAs preserve area/session; search query,
  category subsections, account disclosure, basket checkout entry and Orders work.
  Light/Dark/System and OS preference changes work. Primary → secondary keyboard
  order, visible focus and reduced-motion zero-duration transition checked.
  No overflow at eight widths, 320px plus 200% text and 720px zoom-equivalent reflow.
  Empty coverage, API failure, loading and failed artwork remain usable/distinct.

The browser's API traffic is test data only: no real OTP, order, payment, inventory
or support mutation. Guest-first checkout/merge source is untouched; placing a real
order or completing authentication was intentionally not tested.

Not verified: NVDA/VoiceOver, automated axe (not installed), physical-device
rendering, actual browser-toolbar 200% zoom (CSS reflow equivalent tested instead).
There is no customer-web lint script; none was claimed. The existing Next warning
about React 18 deprecation is not a new dependency change.

## Screenshots

Saved locally under `output/playwright/` (ignored verification artifacts):

- `grocery-hero-{light,dark}-{1672,1440,1366,1024,768,390,360,320}.png`
- `grocery-hero-unconfirmed.png`, `grocery-hero-focus.png`
- `grocery-hero-text-200.png`, `grocery-hero-zoom-reflow.png`
- `grocery-hero-empty.png`, `grocery-hero-error.png`, `grocery-hero-loading.png`
- `grocery-hero-image-failure.png`

Desktop/tablet captures: height 941; phone: viewport height 844, full-page capture.
Chromium DPR approximately 1, visualViewport scale 1 (100%); font loading confirmed
before capture. Browser scrollbars reduce available content width where applicable.
Reference comparison was visual, iterated on actual rendered output, not a claimed
pixel-perfect diff or a conversion/production-checkout benchmark.

## Verdict

**Approve** for the hero scope and checks listed. Backend, other apps, dependencies,
configuration and production data were not edited. The owner's later push request
authorizes the existing protected release workflow after these checks.
