# Deliberate design deviations

Updated 2026-10-05.

| Reference | Connected implementation | Reason |
| --- | --- | --- |
| Illustrated milk, eggs and other product cards with example prices | Real catalogue products/offers; neutral image-unavailable tile where `imageUrl` is absent | Fictional packaging or amounts would misrepresent the existing catalogue. Supplied SVGs remain decorative in the home hero only. |
| Nearby shops shown before a delivery location is known | Explicit GPS or manual map selection before showing nearby shops/products | A fallback coordinate must not be presented as the customer's location or delivery eligibility. |
| Example SMS, Google and payment simulation states | Real OTP and configured Google paths; no mock Google/OTP; COD only | Authentication and hosted payment claims require configured providers. |
| Live-looking rider map and ETA | Existing order events and last-reported location only | No artificial moving rider, countdown or implied live GPS. |
| Screenshot-specific products, shops, totals and review badges | Existing API catalogue, shop and basket data | No hardcoded business data in the connected experience. |

The previous web layout included Google Analytics. It was not restored in this implementation because adding that third-party telemetry egress was rejected by the workspace safety review. Restoring it requires explicit approval of the destination and data collection scope.
