# SirfBazar — production deployment (Render)

Everything runs on Render, provisioned from a single blueprint ([render.yaml](../render.yaml)).
DNS stays on Cloudflare for the `sirfbazar.com` domain.

| Piece | Render service | URL |
|---|---|---|
| Backend API (`apps/api`) | Web Service `sirfbazar-api` | `https://sirfbazar-api.onrender.com` → optionally `api.sirfbazar.com` |
| Customer website (`apps/web`) | Web Service `sirfbazar-web` | `https://sirfbazar.com` (+ `www`) |
| Admin dashboard (`apps/admin`) | Static Site `sirfbazar-admin` | `https://admin.sirfbazar.com` |
| Database | Render PostgreSQL `sirfbazar-db` | internal |

## 1. Deploy with the blueprint

1. [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint**.
2. Connect GitHub and select `CryptoSodi/SirfBazar`. Render reads `render.yaml` and shows the 4 resources.
3. Click **Apply**. First build takes a few minutes; the API runs
   `prisma db push` + the (idempotent) demo seed automatically on every boot.
4. Verify: `https://sirfbazar-api.onrender.com/api/products/categories` returns JSON,
   and the website service URL shows products.

Every `git push` to `master` redeploys all three services automatically.

> If Render says a service name is taken and appends a suffix (e.g.
> `sirfbazar-api-x7k2.onrender.com`), update `NEXT_PUBLIC_API_URL` on
> `sirfbazar-web` and `VITE_API_URL` on `sirfbazar-admin` to the real API URL
> (Environment tab), then redeploy those two.

## 2. Custom domains (Cloudflare DNS)

On each Render service → **Settings → Custom Domains**, add:

- `sirfbazar-web`: `sirfbazar.com` and `www.sirfbazar.com`
- `sirfbazar-admin`: `admin.sirfbazar.com`
- `sirfbazar-api`: `api.sirfbazar.com` *(optional — frontends work fine against the onrender URL)*

Render shows the exact DNS target for each. In Cloudflare DNS add:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `@` | `sirfbazar-web.onrender.com` | DNS only (grey) |
| CNAME | `www` | `sirfbazar-web.onrender.com` | DNS only (grey) |
| CNAME | `admin` | `sirfbazar-admin.onrender.com` | DNS only (grey) |
| CNAME | `api` | `sirfbazar-api.onrender.com` | DNS only (grey) |

Keep records **grey-cloud (DNS only)** while Render issues its certificates (it
uses HTTP validation). Once each domain shows *Certificate Issued* on Render you
may flip records to proxied (orange) if you want Cloudflare's CDN/WAF — set
Cloudflare SSL/TLS mode to **Full (strict)** if you do.

If you attach `api.sirfbazar.com`, update the two frontend env vars to
`https://api.sirfbazar.com/api` (CORS for all domains is pre-configured).

## 3. Database

- The blueprint wires `DATABASE_URL` from the managed Postgres into the API automatically.
- **Render's free Postgres expires after 90 days** — upgrade the database (the
  services can stay free) or migrate before then. Render emails warnings.
- Backups: free tier has no automated backups; `pg_dump` with the external
  connection string when you care about the data.

## 4. Free-tier behaviour

Free web services spin down after ~15 min idle; the first request then takes
~30–60s while the API and/or website wake. Upgrading just `sirfbazar-api` to
Starter removes most of the pain (the website can stay free).

## 5. Local development

Local dev now uses Postgres too. Either:

```powershell
docker compose up -d          # local postgres matching apps/api/.env
cd apps\api
npx prisma db push
npm run seed
npm run dev
```

…or paste your Render database's **External** connection string into
`apps/api/.env` as `DATABASE_URL` and skip Docker.

## 6. Go-live checklist

- [ ] Blueprint applied; all 3 services + DB live
- [ ] `https://sirfbazar-api.onrender.com/api/products/categories` returns JSON
- [ ] Website shows shops/products; place a test order end-to-end
- [ ] Custom domains attached + Cloudflare CNAMEs created (grey-cloud)
- [ ] Frontend env vars point at the final API URL
- [ ] When the real OTP provider arrives: `OTP_PROVIDER=external` + `OTP_PROVIDER_BASE_URL`/`OTP_PROVIDER_API_KEY` on `sirfbazar-api` (until then anyone can log in with master code **123456** — fine for demo, not for launch)
- [ ] Real Google login: `GOOGLE_AUTH_PROVIDER=google` + `GOOGLE_CLIENT_ID`
- [ ] Calendar reminder: free Postgres expires after 90 days
