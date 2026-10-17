# Merchant workspace tour interaction

Reference: Instacart Pickup Enterprise Dashboard onboarding animation, supplied by the user on 2026-10-16. The reference dims the live dashboard, spotlights a navigation target, and attaches a short step card with progress, back/next, and a way to exit. This is an interaction reference, not artwork or a layout to copy.

SirfBazar keeps its current merchant UI and uses seven short, contextual steps: overview, shop settings, products, browse catalogue/add products, orders, riders, and iPOS. Advancing changes to the relevant existing route and spotlights a real control there. No data is written by the tour.

States:

- First verified merchant sign-in: open at the overview, step 1. Completion is stored per merchant user and shop.
- Next/back: navigate to the step's existing page, update the spotlight and progress, and focus the card heading. The final button completes the tour.
- Pause (close button or Escape): hide the overlay, keep the current step, and show a small Continue tour control. Skip marks the tour done.
- Replay from account menu or the development-only test button: restart at step 1. These controls never alter shop records.
- Slow/lazy page load or absent target: keep the explanation card visible without a spotlight until the target appears; never leave the tour blank.
- Narrow viewport: spotlight the visible mobile menu for navigation steps and place the card within safe-area margins, away from the top header. Do not rely on hover.
- Keyboard/screen reader: native modal dialog, named heading/description, visible focus, Escape to pause, previous/next buttons, progress announced in text. Reduced-motion users get no staged animation.
