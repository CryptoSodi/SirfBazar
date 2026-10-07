# Google Stitch: customer native design reference

The HTML in this pack is already the selected composition for implementation. Do not make new Stitch output a prerequisite for reproducing it, and do not replace it with an unexplained alternate design. Use the user's existing MCP connection only when actually available. Discover actual tools/project IDs; never fabricate an export or claim a local HTML was created in Stitch.

## Common instruction for every batch

Design/refine the **native customer app**, not the responsive website, merchant dashboard or rider app. Use the actual attached customer-mobile reference screens and the supplied approved basket/wordmark. Preserve #009966 identity, #007A52 actions, full Light/Dark/System palettes, Plus Jakarta Sans intent, exact one-line Urdu slogan and390 × 844 logical composition. Keep Home/Basket/Orders/Account tabs, and focused checkout/detail action docks. No forced login on landing/Add/Basket. Use fictional records only and do not invent API features. Return the actual generated references and note deviations. Read SIRFBAZAR_CUSTOMER_MOBILE_DESIGN.md for interactions and API_CONTRACT_MAP.md for source-supported scope.

## Batch A — shopping

C01–C08: unlocated/selected-area Home, categories, search/filter, shops, shop detail, product/seller offers and global catalogue. Global catalogue has no invented offer price/Add. Show who fulfils the order, quantity/unit, visible Add on actual merchant listings. Preserve the selected reference composition rather than adding a huge promotional carousel.

## Batch B — basket and address

C09–C13: one/two-shop baskets, group charges and global summary, guest address draft, location explanation and map-unavailable/real-map region. Second shop never silently replaces basket. Don't invent GPS/service guarantees or save private addresses before auth.

## Batch C — checkout identity

C14–C18 and C42: OTP/Google sheet, code entry, merge review/error, final review, sent receipt. Login is deliberate checkout continuation. No auto-placement after auth. Separate Place order. Preserve the draft through cancellation/errors and theme switching.

## Batch D — after ordering

C19–C22 and C29–C31: per-shop tracking, separate delivery selection, details/history, issue, replacement decision and rating. Exact returned statuses, customer-only masked-code fixture and current API roles. No customer buttons that dispatch/deliver an order or simulate real financial effects.

## Batch E — account

C23–C28 and C41: guest/member account, addresses/editor, appearance, help and notifications. Appropriate optional sign-in for private actions; no password/CNIC/merchant onboarding. No persistent favorites or loyalty product unsupported by the API.

## Batch F — failures

C32–C40: empty, no service/results, loading, API error, stock/price change, expired session, uncertain placement, unconfirmed payment. Keep each visually distinct from a successful zero-data state. Recovery doesn't clear basket or retry uncertain writes automatically.

For each batch supply matching light/dark states and reduced-motion annotations. System mode uses the same two effective palettes. Final implementation stays tied to the selected local reference unless the owner explicitly approves new screenshots.
