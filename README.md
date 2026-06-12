# SirfBazar

**Your nearby bazar, now online.** SirfBazar is a hyperlocal multi-merchant commerce and delivery platform: customers order groceries, pharmacy essentials, bakery items and more from trusted local shops nearby; merchants manage their own storefront, inventory, and riders; SirfBazar provides the software, payments, tracking, and marketplace operations.

Unlike dark-store models, SirfBazar **owns no inventory and no warehouses** — every order is fulfilled by a real local shop using the shop's own riders.

## Repository layout

| App | Path | Stack | Port |
|---|---|---|---|
| Backend API | `apps/api` | NestJS 10 · Prisma 6 · SQLite (dev) / PostgreSQL (prod) · Socket.IO | 3001 |
| Customer website | `apps/web` | Next.js · Tailwind | 3000 |
| Admin dashboard | `apps/admin` | Vite · React · Tailwind | 5173 |
| Customer mobile app | `apps/customer-app` | Expo (React Native) | — |
| Merchant mobile app | `apps/merchant-app` | Expo (React Native) | — |
| Rider mobile app | `apps/rider-app` | Expo (React Native) | — |
| Docs | `docs/` | API contract, conventions, architecture | — |

## Quick start (development)

Prereqs: Node.js 20+, npm.

```powershell
# 1. Backend API
cd apps/api
npm install
copy .env.example .env
npx prisma db push          # creates SQLite dev.db
npm run seed                # demo data: Lahore shops, products, riders, coupons
npm run dev                 # http://localhost:3001  (Swagger: /docs)

# 2. Customer website (new terminal)
cd apps/web
npm install
npm run dev                 # http://localhost:3000

# 3. Admin dashboard (new terminal)
cd apps/admin
npm install
npm run dev                 # http://localhost:5173

# 4. Mobile apps (Expo; requires Expo Go on a device or an emulator)
cd apps/customer-app && npm install && npx expo start
```

End-to-end smoke test (API must be running and seeded):

```powershell
cd apps/api
npm run smoke
```

## Demo accounts (seeded)

| Role | Login | Notes |
|---|---|---|
| Customer | any phone number + OTP | dev master OTP code: **123456** |
| Customer (Google) | dev token `mock:you@example.com:Your Name` | mock Google verifier in dev |
| Merchant owners | `+923010000001` … `+923010000004` + OTP 123456 | Madina General Store, Fresh Basket, Sheikh Bakers, CarePlus Pharmacy (Lahore) |
| Riders | `+923020000001` … `+923020000005` + OTP 123456 | belong to the merchants above |
| Super admin | `admin@sirfbazar.pk` / `Admin@12345` | admin dashboard login |
| Finance admin | `finance@sirfbazar.pk` / `Admin@12345` | |
| Support agent | `support@sirfbazar.pk` / `Admin@12345` | |

Delivery completion OTP also accepts **123456** in dev.

## Core product rules (implemented)

- **Zero-friction browsing** — guests browse shops/products, search, and build a cart with no account; login (Google or phone OTP) is requested only at order placement, and the guest cart merges into the account.
- **Merchant-managed delivery** — riders belong to a merchant; a merchant can only assign its own riders; riders only see their own assigned orders.
- **Multi-merchant checkout** — one cart across shops becomes a parent order with one child order per merchant, each independently fulfilled and tracked.
- **Full order timeline** — every status change writes an `OrderTimeline` entry and is pushed in real time (Socket.IO) to customer, merchant, rider, and admin.
- **Money integrity** — all amounts are integers in paisa; commission, fees, coupons, refunds (to wallet), and merchant settlements are computed server-side and audited.
- **OTP-verified delivery** — the customer's 4-digit code (revealed in tracking after pickup) is required to complete delivery.
- **Provider-agnostic OTP/SMS** — `IOtpService` with a dev mock; the real provider plugs in via env (`OTP_PROVIDER=external`) without code changes elsewhere.

## Deployment

Production topology (see [docs/deployment.md](docs/deployment.md) for the full step-by-step):
- `sirfbazar.com` + `www` — customer website on **Vercel** (root dir `apps/web`)
- `admin.sirfbazar.com` — admin dashboard on **Vercel** (root dir `apps/admin`)
- `api.sirfbazar.com` — backend API self-hosted behind a **Cloudflare Tunnel**
- DNS on **Cloudflare** (Vercel records grey-cloud, tunnel record orange)

## Production notes

- Switch Prisma datasource to `postgresql` and set `DATABASE_URL`; the schema is portable (status strings instead of enums by design).
- Set strong `JWT_SECRET`, real `GOOGLE_CLIENT_ID` (`GOOGLE_AUTH_PROVIDER=google`), and OTP provider credentials.
- Object storage (S3-compatible), FCM push, and real payment gateways (JazzCash/EasyPaisa/cards) integrate behind the existing payment `initiate/confirm` flow.
- See `docs/architecture.md` and `docs/api-contract.md`.
