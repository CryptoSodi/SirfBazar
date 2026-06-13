# SirfBazar — Users & Apps Reference

A complete guide to every application in the SirfBazar platform, who uses it, how
they log in, and what they can do. Last updated for the live deployment.

---

## 1. Live URLs

| App | URL | Hosted on |
|---|---|---|
| Customer website | https://www.sirfbazar.com (and https://sirfbazar.com) | Vercel |
| Admin dashboard | https://admin.sirfbazar.com | Vercel |
| Backend API | https://api.sirfbazar.com/api | Self-hosted (this PC) via Cloudflare Tunnel |
| API docs (Swagger) | https://api.sirfbazar.com/docs | same |
| Customer mobile app | Expo (`apps/customer-app`) — run with `npx expo start` | device / emulator |
| Merchant mobile app | Expo (`apps/merchant-app`) | device / emulator |
| Rider mobile app | Expo (`apps/rider-app`) | device / emulator |

All apps talk to the one backend API at `https://api.sirfbazar.com/api`.

---

## 2. The six applications

### 2.1 Customer Website (`apps/web`, Next.js)
The public storefront and marketing site.
- **Who:** anyone — shoppers, plus people learning about SirfBazar.
- **Guest browsing (no login):** see nearby shops & products, search, view product
  and shop pages, build a cart, start checkout.
- **Login required only at:** placing the order, viewing order history, profile,
  saved addresses, ratings, support tickets.
- **Key pages:** home, search, category, product, shop, cart, checkout, order
  tracking, profile, plus marketing pages (how-it-works, become-a-merchant,
  become-a-rider, about, FAQs, contact, privacy, terms, refund policy).

### 2.2 Admin Dashboard (`apps/admin`, React + Vite)
The marketplace operations console.
- **Who:** SirfBazar staff (admins, finance, support).
- **Login:** email + password at `/login`.
- **Sections:** dashboard metrics & analytics, orders, merchants (approve/reject/
  suspend, set commission), riders, customers, products (approval queue),
  categories, coupons, refunds, settlements, support tickets, audit log.

### 2.3 Customer Mobile App (`apps/customer-app`, Expo / React Native)
Same experience as the website, native. Guest browse → cart → login-at-checkout
(phone OTP or Google) → track order → rate. Bottom tabs: Home, Search, Cart,
Orders, Profile.

### 2.4 Merchant Mobile App (`apps/merchant-app`, Expo / React Native)
The shop owner's control panel.
- **Login:** phone OTP (the phone number registered for the shop).
- **Tabs:** Dashboard (today's orders, sales, online toggle), Orders (accept →
  prepare → ready → assign rider), Products (price/stock, availability), Riders
  (add/activate/deactivate your own riders), More (earnings, settlements, logout).

### 2.5 Rider Mobile App (`apps/rider-app`, Expo / React Native)
Used by a merchant's delivery riders.
- **Login:** phone OTP (the number the merchant registered for them).
- **Flow:** go online → see assigned orders → navigate to shop → arrived → picked
  up → navigate to customer → arrived → enter the customer's delivery code →
  delivered. Shares live location during active delivery; can view history.

### 2.6 Backend API (`apps/api`, NestJS + Prisma + PostgreSQL)
One API serving all five clients. JWT auth (access + refresh tokens), role-based
access, Socket.IO for real-time order/rider updates, PostgreSQL database.

---

## 3. User roles

| Role | Logs in via | Uses | Can do |
|---|---|---|---|
| **Guest** | nothing | website / customer app | Browse, search, build cart, start checkout |
| **Customer** | Google or phone OTP | website / customer app | Place & track orders, addresses, wallet, ratings, support |
| **Merchant Owner** | phone OTP | merchant app | Full control of own shop: products, inventory, orders, riders, staff, earnings |
| **Merchant Staff** | phone OTP | merchant app | Limited shop functions per granted permissions (orders / inventory / riders / finance / store / promotions) |
| **Rider** | phone OTP | rider app | Only their own assigned deliveries; update status; share location |
| **Admin** | email + password | admin dashboard | Manage merchants, orders, products, customers, riders, content |
| **Super Admin** | email + password | admin dashboard | Everything an admin can, plus full system control |
| **Support Agent** | email + password | admin dashboard | Orders & support tickets |
| **Finance Admin** | email + password | admin dashboard | Payments, refunds, settlements, financial reports |

**Hard security rules enforced by the API:**
- A customer sees only their own orders & data.
- A merchant manages only their own shop, products, riders, and orders.
- A merchant can assign **only their own riders** to an order.
- A rider sees **only orders assigned to them**, and never the customer's delivery
  code (the customer reads it out at the door).

---

## 4. Demo / seeded accounts

> **Development login shortcut:** the OTP provider is currently in *mock* mode, so
> the master code **`123456`** works for any phone-OTP login (customer, merchant,
> rider) and also as the delivery-completion code. The same applies to the live
> deployment until a real SMS provider is connected — see "Security to-dos".

### Admin dashboard logins (email + password)
| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@sirfbazar.pk` | `Admin@12345` |
| Finance Admin | `finance@sirfbazar.pk` | `Admin@12345` |
| Support Agent | `support@sirfbazar.pk` | `Admin@12345` |

### Seeded merchants (login in the merchant app with phone + code `123456`)
| Shop | Type | Owner phone | Area (Lahore) |
|---|---|---|---|
| Madina General Store | Grocery | `+923010000001` | Gulberg III |
| Fresh Basket Fruits & Veggies | Fruits & Vegetables | `+923010000002` | Gulberg II |
| Sheikh Bakers & Sweets | Bakery | `+923010000003` | Liberty Market |
| CarePlus Pharmacy | Pharmacy | `+923010000004` | Main Boulevard |

### Seeded riders (login in the rider app with phone + code `123456`)
| Rider | Phone | Works for |
|---|---|---|
| Aslam Pervaiz | `+923020000001` | Madina General Store |
| Waqas Ali | `+923020000002` | Madina General Store |
| Junaid Iqbal | `+923020000003` | Fresh Basket |
| Shahbaz Ahmed | `+923020000004` | Sheikh Bakers |
| Rashid Mehmood | `+923020000005` | CarePlus Pharmacy |

### Customers
No seeded customers — anyone can create one instantly: open the website/app, shop,
and at checkout log in with **any phone number + code `123456`**, or "Continue with
Google" (dev mock accepts a demo email).

### Coupons (try at checkout)
| Code | Benefit | Condition |
|---|---|---|
| `WELCOME10` | 10% off (max Rs 150) | First order, min Rs 300 |
| `SAVE50` | Rs 50 off | Min order Rs 500 |
| `FREESHIP` | Free delivery | No minimum |

---

## 5. End-to-end demo flow

1. **Customer** (website or app): browse Lahore shops → add items → checkout → log
   in with any phone + `123456` → place a COD order.
2. **Merchant** (merchant app, `+923010000001` + `123456`): see the new order →
   Accept → Preparing → Ready → Assign a rider.
3. **Rider** (rider app, `+923020000001` + `123456`): go online → open the assigned
   order → Arrived at shop → Picked up → Arrived at customer → enter the customer's
   4-digit delivery code (shown on the customer's tracking screen, or `123456`) →
   Delivered.
4. **Customer:** watch live status/rider location; once delivered, rate the order.
5. **Admin** (`admin@sirfbazar.pk` / `Admin@12345`): see the order, GMV, and
   generate/settle merchant payouts.

---

## 6. Money & units
All amounts are stored as **paisa** (100 paisa = 1 PKR) and shown as `Rs <value>`.
Commission, delivery/service/small-order fees, coupons, refunds (to customer
wallet), and merchant settlements are all computed server-side.

---

## 7. Infrastructure summary

```
Customer Web ─┐
Admin Dash  ──┤
Customer App ─┼──► https://api.sirfbazar.com/api ──► PostgreSQL (this PC)
Merchant App ─┤        (Cloudflare Tunnel → localhost:3001)
Rider App   ──┘
```

- **Frontends:** Vercel (free tier, no cold starts; Hobby plan = non-commercial).
- **API + Database:** self-hosted on this PC; PostgreSQL 18; exposed via the
  existing Cloudflare Tunnel (`api.sirfbazar.com → localhost:3001`).
- **DNS:** Cloudflare (`sirfbazar.com` zone).
- **Repo:** https://github.com/CryptoSodi/SirfBazar — pushing to `master`
  auto-redeploys both Vercel projects.

---

## 8. Security to-dos before a real public launch

These are intentionally in demo mode right now:

- **OTP is mocked** → anyone can log in with `123456`. Set `OTP_PROVIDER=external`
  plus the provider's `OTP_PROVIDER_BASE_URL` / `OTP_PROVIDER_API_KEY` in
  `apps/api/.env` once you have an SMS provider, then restart the API.
- **Google login is mocked** → set `GOOGLE_AUTH_PROVIDER=google` + `GOOGLE_CLIENT_ID`.
- **Change the admin passwords** from the seeded `Admin@12345`.
- **Always-on:** make PostgreSQL + the API auto-start on boot (Windows service +
  pm2/Task Scheduler) so a reboot doesn't take the marketplace offline.
- **Back up** the database regularly (`pg_dump`).
