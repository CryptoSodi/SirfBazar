# Source observations and release gates

These are observations from inspected source or an explicitly retained earlier baseline, **not a claim that the deployed backend is currently exploitable, unchanged or fully audited**. Check current checkout and deployment before deciding a fix is still necessary.

| Priority | Evidence | Required next action |
|---|---|---|
| Blocking for genuine online payment | N4: native CheckoutScreen auto-calls `/payments/:id/confirm` after initiate; E2: earlier service returns a mock gateway. | Remove dev auto-confirm from normal native path. Offer online payment only via a verified actual provider flow. No production test charge/confirmation without approval. |
| Blocking for dependable late auth | N3: afterLogin catches every merge error; B2: additive merge loop is not wrapped in one transaction. | Surface outcome, preserve guest context, serialize merge intent, reconcile before retry. Record separately authorized server transaction/idempotency needs. |
| Important for location and pricing | N3: absent location returns fixed Lahore coordinates, guest session city hardcoded. | Keep unknown location distinct; validate confirmed address coordinates; don't label defaults detected. Never show a location-dependent total from an unrelated browse location. |
| Important for session recovery | N3: ensureGuestToken stores response without status/schema validation; API attaches bearer broadly. | Validate and serialize guest creation, handle expiry without silent cart destruction; ensure stale private auth cannot block public browsing. |
| Important for amounts | N3: pkr rounds to whole rupees and defaults null to zero. | Use verified integer paisa and preserve nonzero minor amounts. Unknown/failed data is not zero. |
| Blocking before promising exact split COD | E2: parent order has shared fees/discount; child totals/rider collection may omit shared amounts. | Verify collection allocation across merchant/rider flows. Don't invent per-rider cash promises in the customer interface. Backend fixes are separately authorized. |
| Important before order retry | E2: no price-version/idempotency guarantee established; notification failures can follow commit. | Revalidate/confirm totals and reconcile uncertain orders. Don't automatically recreate on timeout. |
| Source compatibility | All: branch blobs and 29 September log are not a live deployment manifest. | Record actual runtime/configuration/version differences; inspect current DTOs and guards. |

Native device tests still needed: genuine Google auth and cancellation, OTP provider limits, native maps/dialer/push, keyboard and Android back, text scaling, cold start, background/foreground/cart restoration, dark/system persistence under actual app storage, order tracking updates and account-switch cache isolation.

Product decisions still needed where not established: restricted/prescription commerce, account deletion/retention, live online providers, persistent favorites, quote locking and full exact-once merge recovery. Do not add unsupported required fields or fake endpoints to make these appear finished.

**Scope:** implement and connect customer frontend using current contracts; report backend changes separately. Do not alter the completed rider/merchant applications or production data under this design task.

## Source references

Read [SOURCES.md](SOURCES.md) and `SOURCE_MANIFEST.json` for N/B/E/W identifiers, actual file hashes, inspected ranges and evidence boundaries. Design decisions are identified as such; no runtime deployment test is implied.
