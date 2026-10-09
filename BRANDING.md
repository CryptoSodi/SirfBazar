# SirfBazar Branding & UI Implementation Guide

**Project:** SirfBazar  
**Identity:** Selected grocery-basket logo / Brand Studio v3  
**Guide version:** 1.0  
**Date:** 27 September 2026  
**Applies to:** Customer website, customer app, merchant tools, rider app, admin dashboard and brand communications.

> Implement the selected SirfBazar identity. Do not use a UI task as an opportunity to redesign the logo, replace the green, introduce another slogan or revive discarded concepts.

## 1. Authority and source of truth

This guide translates the user's selections and the delivered v3 brand studio into project instructions. It is not a new branding exploration or a specification for changing the application's business logic.

Three labels distinguish the basis of each rule:

- **LOCKED:** An explicit user choice. Changes require the owner's approval.
- **V3 BASELINE:** A choice implemented in the latest delivered brand studio or its assets. Preserve it unless a documented change is approved.
- **IMPLEMENTATION DEFAULT:** A practical recommendation added in this guide where production details were not specified. Validate it in the actual application; do not describe it as a previously approved design specification.

### Reference order

1. The user's latest explicit decisions: simple basket logo, `#009966`, no leaf-based identity and the exact Urdu slogan on one horizontal line.
2. The named SVG assets in `SirfBazar_Brand_Studio_v3/assets/`.
3. `SirfBazar_Brand_Studio_v3.html`, `brand-tokens.css` and `README.md` in the v3 package.
4. The earlier written brand brief, only where it does not conflict with the later decisions.
5. Implementation defaults in this guide.

**Superseded:** Blue-and-mango branding, hanging-sign/SB concepts, leaf logos, shopfront/crate/tile alternatives, the earlier two-line slogan, and the earlier provisional Bricolage Grotesque/DM Sans direction. Do not bring them back.

The HTML is an identity reference and front-end demonstration, not the application's production specification. Its tiny phone-preview text, sample merchants, prices, delivery estimates, navigation and one-shop basket behaviour are not automatically approved production requirements.

No application repository was inspected to produce this guide. Proposed repository paths and component names below are integration recommendations, not claims about existing code.

## 2. Identity at a glance

| Element | Requirement | Basis |
| --- | --- | --- |
| Brand name | `SirfBazar`, as one name with capital S and B | LOCKED / V3 |
| Selected mark | Simple shopping basket with its handle and three vertical openings | LOCKED |
| Full signature | Basket + supplied SirfBazar wordmark + single-line Urdu slogan | LOCKED / V3 |
| Primary brand green | `#009966` | LOCKED |
| Action green | `#007A52` | V3 BASELINE |
| Wordmark/text ink | `#071F18` | V3 BASELINE |
| Exact slogan | `بازار وہی۔ طریقہ نیا۔` | LOCKED |
| Slogan layout | One continuous horizontal right-to-left line | LOCKED |
| Latin interface font | Plus Jakarta Sans | V3 BASELINE |
| Urdu treatment | Supplied outlined artwork; Noto Sans Arabic for live text | V3 BASELINE |
| General character | Clear, approachable, everyday and well-made | V3 BASELINE |

Use the complete name in normal prose, page titles and accessible labels. Do not rename the product `Sirf Bazar`, `SirfBazaar` or `SB`. Uppercase editorial labels are acceptable, but they do not replace the actual wordmark.

## 3. What the brand represents

**Project context:** SirfBazar connects customers with nearby local shops for groceries and everyday essentials. Merchants prepare orders and use their delivery arrangements, including their own riders. The platform is not being presented as a SirfBazar-owned chain of warehouses or supermarkets.

**Positioning from the existing brief:** Familiar shops. Easier shopping.

The experience should support three ideas:

| Idea | What the interface must communicate |
| --- | --- |
| Familiarity | Which shop the customer is buying from |
| Clarity | What the order costs, its actual status and who handles delivery |
| Ease | Customers can begin browsing without forced registration |

These are intended brand principles, not claims about measured customer perception or proven operational performance.

Make the merchant visible rather than allowing platform branding to obscure the seller. Do not invent verification, delivery guarantees, discounts or evidence of merchant participation to make a design look complete.

## 4. Logo assets and approved uses

### 4.1 Use the supplied artwork

**LOCKED / V3 BASELINE**

Use the named vector files from the v3 ZIP. Do not recreate the wordmark with ordinary text, draw a replacement basket with CSS, substitute an icon-library basket, trace another board or crop the presentation image for production.

Several earlier presentation images have similar filenames. A generic file such as `imagegen.png` or `sirfbazar_brand_identity_board.png` is not a reliable production asset reference. Use the following named exports.

| SVG filename | Intended use |
| --- | --- |
| `sirfbazar-primary.svg` | Horizontal basket, wordmark and single-line Urdu slogan; main brand signature |
| `sirfbazar-horizontal-no-slogan.svg` | Compact navigation/header logo when the slogan would be too small |
| `sirfbazar-stacked.svg` | Centred compositions, square layouts and packaging applications |
| `sirfbazar-reverse.svg` | White horizontal signature for dark or green backgrounds |
| `sirfbazar-stacked-reverse.svg` | White stacked signature for dark or green backgrounds |
| `sirfbazar-monochrome.svg` | Single-colour signature for receipts and one-ink applications |
| `sirfbazar-basket.svg` | Standalone green basket for small brand placements |
| `sirfbazar-basket-white.svg` | Standalone white basket for dark backgrounds |
| `sirfbazar-wordmark.svg` | Wordmark-only placement where separately required |
| `sirfbazar-slogan-urdu.svg` | Exact standalone, single-line outlined Urdu slogan |
| `sirfbazar-app-icon-green.svg` | Green square master with white basket |
| `sirfbazar-app-icon-white.svg` | White square master with green basket |
| `sirfbazar-app-icon-ink.svg` | Deep-ink square master with white basket |

Every listed SVG has a same-named PNG counterpart in the v3 package. Use SVG where the target renderer supports it; otherwise use an appropriately sized PNG counterpart. Check actual output dimensions before using a PNG for print or high-density display.

### 4.2 Construction and colour

The supplied primary vector uses:

- Basket: `#009966`.
- Latin wordmark: `#071F18`.
- Urdu slogan: `#007A52`.

The monochrome master uses `#111111`; the reversed masters use white. These are intentional variants, not permission to recolour the main identity arbitrarily.

The v3 logo and slogan are vector outlines, not live font text. Loading Plus Jakarta Sans does not reproduce the exact logo lettering. Keep the supplied paths intact.

### 4.3 Placement rules

Preserve the aspect ratio, relative proportions, spacing and slogan placement inside each exported lockup. Apply spacing around the complete asset, not between its internal elements.

Use the full signature only when the slogan remains readable. Use the no-slogan lockup in tight headers, then the basket alone in genuinely icon-sized placements. Do not force the full signature into a favicon or navigation button.

On a dark or green field, use the supplied reversed artwork. Do not apply a global CSS filter to an entire colour logo to simulate a new variant. Do not place a dark wordmark on a similarly dark surface.

Keep the identity upright in functional UI. Rotation, shadows and physical effects belong to presentation mockups, not the logo artwork itself. A photograph or patterned background needs a quiet backing area.

**IMPLEMENTATION DEFAULT:** Reserve external clear space of at least one-quarter of the visible basket's height around the lockup where space permits. This is a starting layout rule, not an approved print specification. The studio's toggleable clear-space guide is also a preview, not a measured logo standard.

No final minimum print size has been approved. Test small digital placements and final physical output before committing them.

### 4.4 Do not

Do not stretch, skew, mirror, outline, bevel, animate individual logo parts or add gradients. Do not replace the basket with a leaf, shopping cart, shopfront, crate, location pin, delivery streak or SB monogram. Do not add those symbols to the selected mark.

Do not move the slogan to two lines, replace it with an older tagline, add typography effects to its lettering or change its punctuation.

### 4.5 App icons

The supplied app-icon masters have `1024 × 1024` square vector canvases. Their rounded corners in the studio are presentation masks, not permanently baked platform shapes.

Reuse the supplied basket scale and placement. Keep slogans and wordmarks out of app icons. Derive platform-specific assets through the project's actual icon pipeline; validate any required masks, safe zones and foreground/background separation there. This guide does not establish platform submission compliance.

The three background treatments are an asset family, not three separate brand identities. The final store-listing treatment has not been separately selected. Do not switch an existing live icon as a side effect of an unrelated UI update.

## 5. The Urdu slogan

### 5.1 Exact wording

**LOCKED**

```text
بازار وہی۔ طریقہ نیا۔
```

Copy this string exactly. Use the Urdu full stop `۔` after both phrases. Do not substitute a hyphen, Latin period or another slogan. Do not manually reverse the characters or split them into individual spans.

The user's latest instruction supersedes the earlier two-line version: the slogan must appear on **one horizontal line**, not a curved, stacked or diagonally arranged treatment.

Roman Urdu may be used in explanatory writing as `Bazar wahi. Tareeqa naya.` It is not a substitute for the Urdu slogan in the selected logo.

### 5.2 Rendering

Prefer `sirfbazar-primary.svg` when the slogan is part of the complete signature. Prefer `sirfbazar-slogan-urdu.svg` for a standalone brand placement requiring identical lettering across devices.

For live text, use the exact string with appropriate language and direction metadata:

```html
<p class="sb-slogan" lang="ur" dir="rtl">بازار وہی۔ طریقہ نیا۔</p>
```

```css
.sb-slogan {
  font-family: var(--sb-font-urdu);
  direction: rtl;
  unicode-bidi: isolate;
  white-space: nowrap;
  word-break: normal;
  overflow-wrap: normal;
  letter-spacing: 0;
  font-weight: 600;
  line-height: 1.7;
  color: var(--sb-action);
}
```

The CSS above is a live-text implementation example, not a replacement for the outlined identity asset. Do not assume a fallback font will match the supplied lettering.

Never fix an overflow problem by clipping the slogan, adding an ellipsis or shrinking it until unreadable. Give it more width, move the complete single-line unit to its own row, or use the supplied no-slogan logo in the constrained placement.

An Urdu slogan does not automatically make every screen an RTL interface. Apply direction to the relevant element; full Urdu localisation is a separate product decision. Isolate Latin brand names, prices and order IDs when mixing scripts.

### 5.3 Accessible logo labels

When an image is the only content of a home link, name the link clearly, for example `SirfBazar home`. Avoid making a screen reader announce the same brand and slogan repeatedly through overlapping `alt`, link labels and adjacent hidden text.

For a standalone informative logo image, use an appropriate text alternative. The visual logo should not be the only way a user can learn essential order or navigation information.

## 6. Colour system

### 6.1 Source palette

**LOCKED for primary green; V3 BASELINE for supporting tokens**

| Token | Value | Role |
| --- | --- | --- |
| `--sb-green` | `#009966` | Primary identity, signature panels and brand accents |
| `--sb-action` | `#007A52` | Primary actions with white labels, links and active controls |
| `--sb-ink` | `#071F18` | Main text, prices, wordmark and deep brand fields |
| `--sb-paper` | `#F7F5EF` | Warm backgrounds and editorial surfaces |
| `--sb-mint` | `#EAF7F0` | Soft highlights and supporting branded surfaces |
| `--sb-white` | `#FFFFFF` | Cards, shopping surfaces and reversed artwork |
| `--sb-text-secondary` | `#587168` | Secondary readable text |
| `--sb-border` | `#DBE3DC` | Quiet dividers and surface boundaries |

The original green remains the main brand colour. The darker action green solves functional text-pairing needs; it must not silently replace `#009966` throughout the identity.

Do not introduce another dominant brand accent. Photography may naturally contain other colours. Functional focus, warning and error treatments are not competing brand palettes, but must have defined roles rather than being arbitrary decoration.

### 6.2 Copyable v3 tokens

These values reproduce the supplied `brand-tokens.css`:

```css
:root {
  --sb-green: #009966;
  --sb-action: #007A52;
  --sb-ink: #071F18;
  --sb-paper: #F7F5EF;
  --sb-mint: #EAF7F0;
  --sb-white: #FFFFFF;
  --sb-text-secondary: #587168;
  --sb-border: #DBE3DC;

  --sb-font: 'Plus Jakarta Sans', 'Inter', Arial, sans-serif;
  --sb-font-urdu: 'Noto Sans Arabic', Tahoma, sans-serif;

  --sb-radius-control: 10px;
  --sb-radius-card: 18px;
  --sb-radius-feature: 22px;
}
```

Map these into the project's existing theme mechanism. Do not create parallel, inconsistent colour sets in CSS, native themes and component props. Equivalent values in a native theme should remain identical.

The studio also uses `#006442` for primary-button hover and `#4762CC` for focus outlines. These are existing interaction treatments, not new primary brand colours. Centralise them as semantic helpers when adopting them.

### 6.3 Text-colour pairings

The following ratios were recalculated from the solid colour values while preparing this guide:

| Foreground / background | Approximate contrast | Project rule |
| --- | --- | --- |
| White / `#009966` | 3.65:1 | Do not use for ordinary small button or body text |
| White / `#007A52` | 5.38:1 | Preferred primary-button pairing |
| `#071F18` / `#009966` | 4.72:1 | Dark text option on primary green |
| `#587168` / white | 5.28:1 | Secondary text on white |
| `#587168` / `#F7F5EF` | 4.84:1 | Secondary text on warm paper |

These pair checks do not certify a page or application as accessible. Opacity, imagery, actual sizes, states and adjacent surfaces still need checking. Use a project target of at least 4.5:1 for normal UI text, as already specified in the supplied brief.

The light border is a decorative-divider token, not proof that a control boundary is sufficiently visible. Provide an adequately visible border, label and focus state where identification depends on the boundary.

## 7. Typography

**V3 BASELINE**

Use **Plus Jakarta Sans** for Latin interface and supporting brand text, with the fallback stack in the tokens above. The studio requests weights 400, 500, 600, 700 and 800. Use **Noto Sans Arabic** for live Urdu text; the supplied outlined slogan was prepared from its SemiBold treatment.

Do not revert to Manrope, Bricolage Grotesque or DM Sans as the main system. Do not introduce a display serif or calligraphic Urdu face as part of this implementation.

Use actual font weights rather than synthetic styles when available. Keep product names readable and prices easy to scan. Avoid excessive uppercase, condensed text or tight letter spacing in transactional screens. The studio's oversized editorial headlines are not a template for every product card.

### Production scale to validate

**IMPLEMENTATION DEFAULT:** The v3 phone is a scaled demonstration, not a production type specification. Start with the following readable scale, adapting it to the existing product and native text scaling:

| Role | Starting size | Weight / treatment |
| --- | --- | --- |
| Marketing hero | 44–72px desktop; 32–44px mobile | 700; short lines |
| Page or section title | 24–36px | 700 |
| Card or section subheading | 18–22px | 600–700 |
| Body and input text | 16px | 400–500; comfortable line height |
| Button label | 14–16px | 600–700 |
| Secondary metadata | 14px | 400–500 |
| Nonessential small label | 12px starting minimum | Avoid where information is important |

Keep Urdu line height generous enough for dots and marks. Do not crop text with fixed-height containers. Test large text settings before reducing a size to force a layout to fit.

The HTML uses optional remotely hosted fonts; its logo artwork does not depend on font loading. Manage application font loading through the actual platform. The delivered kit contains no font files. Do not assume fonts are embedded or available offline.

## 8. Layout, surfaces and motion

**V3 BASELINE:** Warm paper, white cards, green accents, deep-ink headings, soft corners, restrained dividers and generous separation. Control/card/feature corner tokens are 10/18/22px respectively.

The presentation uses a maximum content width of 1320px and responsive adaptations. This is a marketing-page reference, not a fixed width for every dashboard or app screen.

**IMPLEMENTATION DEFAULT:** Use a spacing rhythm of 4, 8, 12, 16, 24, 32, 48 and 64 logical units. Start with 16–20px mobile page padding and adapt to the application's actual layout. Preserve useful density in admin tools without shrinking labels or touch targets.

Do not fill every surface with green, add shadows to every card, introduce dark sci-fi panels or use pill corners on every component. Do not copy the presentation's decorative rotated app tiles into normal navigation.

Use short, restrained state transitions. Honour reduced-motion preferences. Do not add bouncing logos, continuously moving backgrounds or decorative motion that interferes with shopping.

A dark logo treatment is not approval for a complete dark-mode interface. Dark-mode surfaces and states need their own verified token mapping.

## 9. Reusable UI rules

**IMPLEMENTATION DEFAULT:** Build shared components within the existing framework rather than styling each screen independently. The names below describe responsibilities; adapt them to the actual repository.

| Component | Branding contract |
| --- | --- |
| `BrandLogo` | Uses a named supplied asset; preserves ratio; chooses primary, compact, stacked, reverse or symbol intentionally |
| `BrandSlogan` | Uses outlined artwork for exact identity, or the exact live RTL string; never wraps |
| `PrimaryButton` | Action green with white label; clear hover, focus, disabled and loading states |
| `SecondaryButton` | White or quiet light surface, ink/action text and a visible boundary |
| `SearchField` | Clearly labelled, readable text, visible focus and a neutral surface |
| `ShopCard` | Prominent merchant name and useful fulfilment information |
| `ProductCard` | Accurate image, name, quantity/unit, real price and a clear add/quantity control |
| `BasketSummary` | Clear subtotal, fees and total; stable route to checkout |
| `OrderStatus` | Text and icon tied to real state; does not rely on colour alone |
| `Toast` / `InlineMessage` | Plain-language feedback; persistent treatment for errors needing action |

The studio's primary button is at least 48px high. Use 48 logical units as a starting production interaction target, especially for touch. This is a project implementation default, not a statement of universal platform requirements.

Show selected navigation through more than a subtle hue shift. Provide accessible names for icon-only buttons. Keep body links identifiable. A loading state must not make the user guess whether an order has been placed.

Use one consistent utility-icon family with compatible stroke weights. The supplied basket is a brand asset, not a reason to replace every navigation icon with it. Do not use emoji as production brand marks or as substitutes for essential labels.

The v3 package does not define a complete error/warning/information palette. Preserve a tested existing semantic system or document new proposals separately. Do not mark errors, pending states and successful states with indistinguishable green badges.

## 10. Product experience and brand behaviour

### Customer experience

**V3 BASELINE / EXISTING PROJECT DIRECTION**

Customers should be able to start browsing without a login wall or compulsory introductory carousel. Google login and OTP belong at the final order-placement stage, not at the entrance to the marketplace. Keep the basket intact through authentication.

A representative sequence is:

```text
Browse → Select shop → Add items → Review basket and charges
→ Sign in / verify at the final step → Submit order → Merchant response
```

Do not alter an existing production state machine merely to match this illustrative sequence. Authentication success is not, by itself, successful order placement or merchant acceptance.

Location should be as low-friction as possible while respecting platform permissions. Provide a manual area/address alternative. Do not claim location access occurred when it did not, or make permission denial an unnecessary browsing dead end.

Keep OTP integration provider-agnostic until a provider is selected. Styling this flow does not authorise replacing the auth stack or selecting a new provider.

### Shop and delivery transparency

Show the merchant's identity through discovery, basket, order details and status updates. Display delivery estimates and fees from actual service data. Explain merchant delivery using the actual fulfilment arrangement.

Do not silently infer a final multi-shop or single-shop checkout policy from the prototype. The demonstration's basket-replacement modal is a demo behaviour; preserve the real product rules unless separately instructed to change them.

### Different product surfaces

| Surface | Apply the identity through |
| --- | --- |
| Customer website/app | Clear browsing, search, products, readable prices and late authentication |
| Merchant tools | Same logo, tokens and type; readable orders and fulfilment controls |
| Rider app | Clear assignment, address and status actions; minimal distracting decoration |
| Admin dashboard | Same visual language; practical tables and information density |
| Notifications/receipts | Correct name, concise copy and real merchant/order information |

Do not create separate unofficial brands or unrelated palettes for the merchant, rider and admin surfaces. Role labels may sit outside the unchanged logo.

## 11. Copy and language

**V3 BASELINE:** Helpful, direct and neighbourly. Prefer clarity over hype. Use sentence case in normal UI.

The selected Urdu line is the brand slogan. Other English or Roman Urdu wording in the studio is supporting campaign copy, not a replacement logo tagline.

| Situation | Copy template from the existing direction |
| --- | --- |
| Explaining browsing | “Browse first. Sign in when you’re ready to order.” |
| Address selection | “Where should we deliver?” |
| Google action | “Continue with Google” |
| Phone action | “Continue with phone number” |
| Submission acknowledged, not yet accepted | “Order sent to [shop]. Waiting for confirmation.” |
| Merchant acceptance | “[Shop] has accepted your order.” |
| Actual merchant-rider dispatch | “Your order is on the way with [shop]’s rider.” |
| Merchant order label | “Ordered on SirfBazar. Prepared by [merchant name].” |

Use placeholders only in labelled demos. Substitute actual data in production. Match wording to real system events and approved support responsibilities.

Avoid “Pakistan’s number one”, “cheapest”, “always fresh”, fixed-minute delivery, fake scarcity or “verified” badges unless the business can substantiate the claim and has approved it. Do not claim every neighbourhood shop is available.

Use the project's currency formatter and backend values. Demo `Rs.` amounts, delivery fees and order IDs are not business commitments. Maintain a clear path to help without implying an unapproved support guarantee.

## 12. Imagery and physical applications

**V3 BASELINE:** Make real products and participating merchants the subject. Show the local shop where appropriate and use accurate product packaging, sizes and quantities.

Do not use leaves or eco symbolism as SirfBazar's visual identity. Literal product photography may naturally include produce; that is different from adding a leaf to the logo or presenting the brand as an environmental certification.

No mascot, character system or illustration style has been selected. Do not invent one during implementation. Do not present generated merchant portraits or fictional stores as real partners.

For a campaign, use the supplied signature, one clear message and a controlled brand field. For a bag or sticker, preserve the mark and avoid competing logo variants. For a merchant label, retain the shop's name and the actual support route.

The studio's bag, social panel and order label are application studies. They are not final print files. Dielines, material choice, print colour conversion, bleed, minimum size and supplier proofs remain unspecified.

## 13. Repository integration

### 13.1 Suggested organisation

**IMPLEMENTATION DEFAULT:** Use equivalent existing folders where available; do not restructure the application solely to match this tree.

```text
project-root/
├── BRANDING.md
├── docs/
│   └── brand/
│       └── SirfBazar_Brand_Studio_v3.html
├── public/
│   └── brand/
│       ├── sirfbazar-primary.svg
│       ├── sirfbazar-horizontal-no-slogan.svg
│       ├── sirfbazar-stacked.svg
│       ├── sirfbazar-reverse.svg
│       ├── sirfbazar-stacked-reverse.svg
│       ├── sirfbazar-monochrome.svg
│       ├── sirfbazar-basket.svg
│       ├── sirfbazar-basket-white.svg
│       ├── sirfbazar-wordmark.svg
│       ├── sirfbazar-slogan-urdu.svg
│       ├── sirfbazar-app-icon-green.svg
│       ├── sirfbazar-app-icon-white.svg
│       └── sirfbazar-app-icon-ink.svg
└── src/
    └── theme/
        └── brand-tokens.css
```

Copy assets from the v3 package; this Markdown file does not embed them. Native projects should use their existing asset system rather than assuming a `/public` route. PNG counterparts are also available when needed.

### 13.2 Central identity configuration

The following TypeScript example is optional scaffolding, not a required framework or a claim that these files already exist:

```ts
export const sirfBazarBrand = {
  name: 'SirfBazar',
  sloganUrdu: 'بازار وہی۔ طریقہ نیا۔',
  colors: {
    primary: '#009966',
    action: '#007A52',
    ink: '#071F18',
    paper: '#F7F5EF',
    mint: '#EAF7F0',
    white: '#FFFFFF',
    textSecondary: '#587168',
    border: '#DBE3DC',
  },
  assets: {
    primary: '/brand/sirfbazar-primary.svg',
    compact: '/brand/sirfbazar-horizontal-no-slogan.svg',
    stacked: '/brand/sirfbazar-stacked.svg',
    reverse: '/brand/sirfbazar-reverse.svg',
    stackedReverse: '/brand/sirfbazar-stacked-reverse.svg',
    monochrome: '/brand/sirfbazar-monochrome.svg',
    symbol: '/brand/sirfbazar-basket.svg',
    symbolReverse: '/brand/sirfbazar-basket-white.svg',
    wordmark: '/brand/sirfbazar-wordmark.svg',
    slogan: '/brand/sirfbazar-slogan-urdu.svg',
  },
} as const;
```

Resolve asset paths against the application's actual base path and deployment environment. A project served from a subdirectory may not use root-relative paths as written.

### 13.3 Implementation sequence

Audit the existing theme, components, assets and tests first. Identify obsolete logos, slogans, fonts and hard-coded brand colours. Confirm which screens are in scope.

Add the named assets and map the shared tokens. Update reusable branding components before changing screens. Apply the changes to navigation, buttons, forms, cards, basket, status screens and communications through those shared components.

Preserve routing, API contracts, auth, payments, delivery calculations, data handling and merchant workflows. Do not migrate the framework or add an illustration library solely for this branding task.

Inspect output at relevant screen widths, text sizes and interaction states. Run available tests. Report the files changed, assets used, checks actually performed and unresolved integration work. Do not claim a prototype action is connected to a live service.

## 14. Acceptance checklist

**IMPLEMENTATION DEFAULT:** These are checks to run in the actual project, not tests already completed for it.

### Identity

- [ ] Every production logo comes from the named selected-basket assets.
- [ ] The primary brand green is exactly `#009966`.
- [ ] The wordmark has not been recreated with live type or distorted.
- [ ] The slogan is exactly `بازار وہی۔ طریقہ نیا۔` on one RTL line wherever shown.
- [ ] The compact version is used instead of an unreadably small full signature.
- [ ] No discarded leaf, SB, shopfront, crate or blue/mango identity remains in active branding.
- [ ] Reversed and monochrome assets are used intentionally on suitable backgrounds.

### Interface and accessibility

- [ ] Shared colours, radii and font families are sourced from one theme.
- [ ] Small white action labels use action green rather than primary green.
- [ ] Text, control boundaries and focus states have been checked in context.
- [ ] Keyboard users can navigate and identify focus; overlays manage focus appropriately.
- [ ] Buttons, icons and form fields have useful accessible names.
- [ ] Loading, disabled, error, empty, success and selected states have been reviewed.
- [ ] Increased text size does not clip essential information or wrap the brand slogan.
- [ ] Reduced-motion preferences are respected.
- [ ] Fonts failing to load do not remove the logo or break essential UI.

### Product integrity

- [ ] Browsing is not newly blocked by authentication or onboarding.
- [ ] The basket is preserved through the actual final-stage auth flow.
- [ ] Merchant identity and fulfilment responsibility remain visible.
- [ ] Order messages correspond to real events, not just button clicks.
- [ ] Mock shops, prices, ratings, availability and delivery times are not presented as live data.
- [ ] No payment, fee, support, coverage or basket-policy change was introduced accidentally.

### Responsive and delivery review

- [ ] Check representative web widths such as 320, 375, 390, 414, 768, 1024 and 1440px where relevant.
- [ ] Check actual native targets and safe areas separately; web previews are not device certification.
- [ ] Check that bottom actions are not hidden by navigation, keyboards or overlays.
- [ ] Verify imported assets and deployment paths, including any subdirectory hosting.
- [ ] Review the visual result against v3 and document intended production adaptations.
- [ ] Report only tests that were actually executed.

## 15. Instructions for a coding assistant

Use the following as an implementation prompt after placing this file and the v3 assets in the project:

```text
Read BRANDING.md before making UI changes. Inspect the existing repository,
its theme and the SirfBazar v3 assets first.

Implement the selected basket identity, not a new branding concept. Keep
#009966 as the primary brand colour, use the supplied vector wordmark and
basket, and preserve the exact single-line RTL slogan:
بازار وہی۔ طریقہ نیا۔

Use Plus Jakarta Sans for Latin UI text and the supplied outlined Urdu
artwork for exact brand placements. Reuse the documented palette and map
it into the existing theme. Use the darker action green for ordinary white
button labels. Build on shared components rather than styling screens
independently.

Do not revive previous leaf, SB, shopfront or blue/mango concepts. Do not
replace missing logo assets with an invented drawing. Report missing
assets or unresolved source conflicts explicitly.

Preserve the current framework, APIs, authentication, payment logic,
merchant workflows and basket rules. Keep browsing low-friction and
merchant identity visible. Do not copy demo data into production.

Distinguish locked choices from implementation defaults. Apply the guide
to the requested scope, check responsive and accessible states, run the
available relevant tests, and report actual changes, tests and blockers.
```

## 16. Limits, pending decisions and change control

The supplied SVGs are practical vector reconstructions of the selected raster concept. They are not evidence of trademark clearance, exclusivity or a final specialist production audit. Review final print and unusually small uses before release.

The final store-listing icon treatment, complete semantic status palette, exact production type scale, precise minimum logo sizes, print specifications and a complete dark-mode system have not been separately approved. The recommendations here do not retroactively make them approved facts.

Authentication, live merchant catalogues, geolocation, payments and order submission were not connected in the brand studio. A branding implementation must not imply those integrations are complete.

Change the selected logo, main colour, wording, typography direction or logo composition only with the owner's approval. Record approved changes in this file, the shared tokens and the asset manifest together. Keep previous assets outside production imports.

### Source register

| Reference | What it supports |
| --- | --- |
| Latest user decisions in the SirfBazar project conversation | Basket selection, green, rejection of leaf imagery, exact slogan and final one-line layout |
| `SirfBazar_Brand_Studio_v3/README.md` | Superseded directions, asset preparation, brand rules and prototype limitations |
| `SirfBazar_Brand_Studio_v3/brand-tokens.css` | Exact palette, font stacks and radius tokens |
| `SirfBazar_Brand_Studio_v3/SirfBazar_Brand_Studio_v3.html` | Visual reference, interaction styling, supporting copy and application studies |
| `SirfBazar_Brand_Studio_v3/assets/*.svg` | Actual logo variants, fills, outlined slogan and square icon masters |
| `Pasted text(20260927-005813).txt` | Earlier supporting palette and merchant-visible, low-friction principles; not its superseded sign/logo or provisional type direction |

**Final rule:** Improve implementation quality without changing the identity the user selected.

## Android App-Role Icons: Approved 9 October 2026

The owner requested distinct Customer, Merchant and Rider icons and approved
integrating the delivered icon family. This is a scoped exception for Android
launcher artwork, not a replacement corporate identity: Customer keeps the
original basket, Merchant uses a storefront containing that basket, and Rider
uses a delivery scooter with the basket on its delivery box. All retain #009966
and the original basket paths. The website, in-app logos, splash screens and
iOS icons remain unchanged. See [Android launcher icons](docs/design/ANDROID_APP_ICONS.md)
for assets, verification and build details.
