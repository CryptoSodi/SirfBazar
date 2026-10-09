# Grocery homepage hero — implementation contract

Scope: only the existing Next.js customer homepage. Use the owner's supplied
desktop reference and opaque 809 × 644 grocery artwork, not a screenshot page.
The named extracted pack, README, ASSET_GUIDE and SOURCE_MANIFEST were not present
in the checkout or supplied Downloads files. The supplied CODEX_PROMPT.md and
SIRFBAZAR_GROCERY_HERO_CODEX.md are the available implementation instructions.

## Interactions and states (recorded before implementation)

- Shop groceries links to the existing `/search` product discovery page.
- Explore local shops links to the existing `/search?type=shops` discovery mode.
- Both remain guest-accessible and use the current saved location; neither
  creates a session, authenticates, changes a basket or places an order.
- With no confirmed location (initial resolution or labelled example area),
  the headline says “from local shops.” A confirmed selected location allows
  “from shops near you.” Header area and basket values remain in the real Header.
- Existing loading, API failure/retry, coverage/change-area, category, shop and
  product sections remain in place and do not gain mock products.
- Use truthful local-shop / shop-managed delivery / everyday groceries /
  clear-order-total benefits. Do not add freshness, speed or payment guarantees.
- Light and Dark use the same intentional pale mint panel and dark readable
  copy, with unchanged artwork. System remains controlled by the real Header.
- Desktop uses a split panel; tablet may wrap benefits; phones place copy and
  both actions first, compact contained artwork last. No fixed text height.
- Links retain visible keyboard focus, work without motion and stay usable
  when artwork fails. No entrance animation or loop is necessary.

The owner's subsequent “when it's done push it” authorizes the existing release
workflow after verification, superseding the handoff's no-deployment constraint.
It does not authorize backend source/configuration or production-data edits.
