# SirfBazar Product Capabilities Report

Generated from the repository on 2026-09-21.

## Executive summary

SirfBazar is a hyperlocal marketplace for independent neighborhood shops. It lets customers discover and order products from nearby merchants while allowing each merchant to keep control of its catalog, stock, order preparation, riders, and in-store sales.

The platform is not a warehouse or dark-store system. SirfBazar provides the shared software and marketplace operations; local merchants own the inventory and fulfill orders with their own riders.

The repository currently contains one backend and seven client applications:

| Application | Path | Primary user |
| --- | --- | --- |
| Backend API | `apps/api` | All clients |
| Customer website | `apps/web` | Shoppers |
| Customer mobile app | `apps/customer-app` | Shoppers |
| Merchant web portal | `apps/shop` | Merchant owners and staff |
| Merchant mobile app | `apps/merchant-app` | Merchant owners and staff |
| Rider mobile app | `apps/rider-app` | Delivery riders |
| Admin dashboard | `apps/admin` | SirfBazar operations staff |
| Browser POS | `apps/pos` | Merchant cashiers |

## What problem the product solves

### For customers

- Makes nearby independent shops searchable and orderable online.
- Combines products from multiple local shops in one cart and checkout.
- Removes account-creation friction by allowing browsing and cart building as a guest.
- Provides delivery status, rider progress, order history, ratings, and support.
- Supports delivery addresses selected manually, from current location, or from a map.

### For merchants

- Provides an online storefront without requiring a merchant to build its own commerce system.
- Keeps price, availability, and inventory under the merchant's control.
- Coordinates order acceptance, preparation, substitutions, rider assignment, and delivery.
- Uses the same inventory for marketplace orders and in-store POS sales.
- Tracks earnings, commission, refunds, and settlement records.

### For riders

- Gives riders a focused workflow for assigned deliveries only.
- Guides the delivery through shop arrival, pickup, customer arrival, and OTP-confirmed completion.
- Shares location during an active delivery and records delivery history.

### For SirfBazar operations

- Centralizes merchant approval, catalog moderation, customer and rider administration, orders, refunds, settlements, support, and audit history.
- Enforces role and tenant boundaries in the API rather than trusting individual clients.
- Records money in integer paisa and calculates fees and commissions on the server.

## Implemented customer capabilities

### Discovery and shopping

- Anonymous location-based browsing.
- Category tree and category browsing.
- Nearby merchant discovery using latitude, longitude, and service radius.
- Nearby, popular, recommended, and searched products.
- Product detail, merchant detail, merchant product list, and merchant reviews.
- Product and shop availability, distance, estimated delivery time, minimum order, price, discount, and stock display.
- Location detection, nearby-area selection, saved location, and Google Maps-based address pinning.

### Guest and customer cart

- Anonymous guest session and guest cart.
- Add, update, remove, and clear cart items.
- Cart grouping by merchant.
- Server-side stock and price revalidation.
- Delivery, service, and small-order fee calculation.
- Coupon application and removal.
- Guest-cart merge after phone or Google login.

### Authentication and profile

- Phone OTP login with expiry, retry limits, and resend cooldown.
- Google identity login.
- Short-lived JWT access tokens and rotating refresh tokens stored hashed in the database.
- Customer profile editing.
- Saved address creation, editing, deletion, and default selection.
- Customer account deletion endpoint.
- Wallet balance and loyalty-point fields displayed in customer profiles.

### Checkout and orders

- Login is requested at checkout rather than before browsing.
- Cash on delivery and gateway-shaped online payment methods.
- One cart can create a parent order with one independently fulfilled child order per merchant.
- Order totals include item subtotal, delivery fee, service fee, small-order fee, discount, and commission.
- Customer order list, order detail, timeline, and delivery tracking.
- Customer cancellation under the allowed status rules.
- Merchant and rider ratings after delivery.
- Customer response to merchant-proposed item replacements.
- Order-linked support ticket creation from the website.

## Implemented merchant capabilities

### Merchant onboarding and store management

- Phone or Google authentication in merchant context.
- New merchant onboarding with shop identity, type, address, map coordinates, hours, minimum order, and shop-front image.
- Admin approval states for submitted, approved, rejected, suspended, inactive, and temporarily closed merchants.
- Store profile editing.
- Online/offline and open/closed controls.
- Merchant document records in the backend.

### Catalog and inventory

- Browse the shared global product catalog.
- Add global products to a merchant's store.
- Merchant-specific price, discount price, stock quantity, low-stock threshold, availability, SKU, and preparation notes.
- Product creation and moderation workflow for catalog items.
- Product update, removal, and backend bulk-upload endpoint.
- Inventory decremented transactionally when an online or POS order is created.
- Stock restored when eligible orders fail or are cancelled.

### Order fulfillment

- Merchant order inbox and order detail.
- Accept or reject an order.
- Move accepted orders through preparing and ready-for-pickup states.
- Mark an item unavailable and optionally propose a replacement.
- Assign only a rider belonging to the same merchant.
- Automatic rejection of orders not accepted within the configured timeout.
- Dashboard totals for current operations and sales.

### People and finance

- Create, view, update, activate, deactivate, approve, and reject merchant riders.
- Merchant staff model with permission keys for orders, inventory, riders, finance, store, promotions, and POS.
- Earnings reporting and settlement history.

## Implemented rider capabilities

- Rider self-application to a selected merchant.
- Merchant approval or rejection of rider applications.
- Rider profile and online/offline presence.
- Assigned-order queue and completed-delivery history.
- Delivery detail with merchant and customer destination information.
- Arrived-at-shop, picked-up, arrived-at-customer, and delivered actions.
- Periodic GPS updates during an active delivery.
- Customer delivery-code verification before completion.
- Delivery issue reporting.
- Rider access is restricted to orders assigned to that rider.

## Implemented POS capabilities

- Merchant-owner and permitted staff login.
- Product search over the merchant's own inventory.
- Product grid with price, availability, and current stock.
- In-store cart with quantity adjustment.
- Cash tender, suggested tender amounts, and change calculation.
- Completed receipt view and browser printing.
- Today, seven-day, and thirty-day sales views.
- POS revenue and receipt history.
- POS orders use `channel=POS`, carry zero marketplace commission, and reduce the same stock used by online orders.

## Implemented admin capabilities

- Email/password and Google admin login.
- Dashboard metrics and date-range analytics.
- Customer list, detail, suspension, and activation.
- Merchant list, detail, approval, rejection, suspension, reactivation, commission, and profile controls.
- Rider list, suspension, and activation.
- Platform-wide order list, order detail, cancellation, and refund actions.
- Product list, creation, editing, approval, rejection, and disabling.
- Category creation, editing, sorting, activation, and deletion.
- Coupon creation, listing, and deletion.
- Refund review and status management.
- Settlement generation, hold, and mark-paid workflows.
- Support ticket list, detail, replies, and status updates.
- Audit-log browsing.
- Role-aware API access for admin, super admin, finance admin, and support agent operations.

## Shared platform capabilities

### Order lifecycle and integrity

- Explicit order-status state machine.
- Immutable order item name, image, unit, and price snapshots.
- Timeline entry for order transitions.
- Transactional stock checks to reduce overselling risk.
- Server-side commission, fee, coupon, refund, and settlement calculations.
- Automatic wallet credit for completed refunds.
- Merchant settlement generation from eligible delivered orders.

### Notifications and realtime foundation

- Persistent in-app notification records.
- Expo push-token registration for customer, merchant, and rider apps.
- Expo push delivery with invalid-token cleanup.
- Socket.IO rooms for users, orders, merchants, riders, and administrators.
- Authorized room joins based on order and merchant ownership.
- Current client applications mainly use polling for operational updates; the realtime server foundation exists for future client integration.

### Security and tenancy

- Global JWT authentication guard and route-level role guard.
- Customer, merchant, rider, staff, finance, support, and admin roles.
- Merchant staff permission checks.
- Customer ownership checks for customer data and orders.
- Merchant ownership checks for inventory, riders, orders, POS sales, and settlements.
- Rider assignment checks for delivery access.
- Hashed refresh tokens and hashed OTP codes.
- Append-only audit records for important administrative and financial actions.

### Developer and operations support

- Swagger API documentation.
- PostgreSQL schema managed through Prisma.
- Seeded Lahore demo shops, riders, products, coupons, and admin accounts.
- API smoke test covering guest shopping, authentication, COD orders, multi-merchant orders, simulated payments, cancellation/refunds, and admin flows.
- GitHub Actions builds the API, customer web, and admin dashboard and runs the API smoke test.
- Docker Compose configuration for local PostgreSQL.
- Vercel configurations for browser clients and Cloudflare Tunnel documentation for the self-hosted API.

## Current product maturity

The repository is a broad working marketplace MVP with a real domain model and connected customer-to-merchant-to-rider workflows. COD ordering, inventory, merchant operations, rider delivery, administration, and basic POS are substantially implemented.

It is not yet production-complete. Several integrations remain in demo mode, some backend capabilities have no client interface, client realtime support is not connected, and production operations need hardening. Those items are detailed in `docs/remaining-work-report.md`.
