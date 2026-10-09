# Merchant order handling

## Reference and boundary

Foodpanda's public partner documentation separates picking/preparation from
pickup readiness, and distinguishes platform delivery from vendor delivery:
https://developer.foodpanda.com/en/documentation/pos-partner-picking-use-cases
https://developer.foodpanda.com/api-specifications
These sources establish the workflow, not every control in its private partner UI.
SirfBazar keeps merchant-managed delivery; it does not add Foodpanda's rider fleet.

## Interaction and states

1. Open a new order's existing sidebar and accept it. Acceptance and preparation
   commit together. The buyer sees Preparing without a second merchant action.
2. While preparing, select an available, approved rider belonging to this shop
   directly in the sidebar. Assignment reserves the rider but does not mark the
   order packed or permit pickup. Rider details and packing actions stay together.
3. Select Mark ready for pickup only when packing is complete. An already assigned
   rider becomes eligible for the existing pickup flow. Without a rider, the order
   stays Ready for pickup and assignment remains available in the same sidebar.
4. Rider pickup changes the buyer view to On the way; delivery verification stays
   unchanged. Older Accepted orders can still be started or marked ready.

Loading, empty rider lists and permission-denied states must explain the next step.
Transient failures use toasts. A failed or lost write response is checked against
the saved order before retry; no optimistic success or automatic duplicate write.
No extra confirmation is needed for assigning the explicitly selected rider;
rejection retains its reason and confirmation because it is destructive.

## Safety

Acceptance, readiness and rider reservation use serializable transactions and
conditional claims. Two riders cannot win the same order; one rider cannot win
two orders. Foreign/inactive/unapproved riders and staff without permissions are
rejected. Early assignment preserves preparation status. Pickup stays blocked
until readiness; cancellation releases only the matching rider reservation.
No database schema, payment, OTP, authentication or production configuration changes.
Native merchant/rider app changes require new binaries before installation.
