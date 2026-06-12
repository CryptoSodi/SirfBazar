# SirfBazar — production deployment

Hybrid topology: frontends on Vercel (no cold starts on the free tier),
backend + database on your own machine.

| Piece | Where | URL |
|---|---|---|
| Customer website (`apps/web`) | Vercel | `https://sirfbazar.com` (+ `www`) |
| Admin dashboard (`apps/admin`) | Vercel | `https://admin.sirfbazar.com` |
| Backend API (`apps/api`) | **Your machine**, exposed via Cloudflare Tunnel | `https://api.sirfbazar.com` |
| Database | **Your machine** — native PostgreSQL | local only |
| DNS / TLS | Cloudflare (`sirfbazar.com` zone) | — |

Both frontends default to `https://api.sirfbazar.com/api` via their committed
`.env.production` files — no dashboard env vars needed. **Until the tunnel is
up, the deployed site loads but shows no data** — expected, not broken.

> Vercel Hobby (free) note: no cold starts and no expiry, but the plan is for
> non-commercial use. Fine for the demo phase; budget Pro ($20/mo) for a real
> commercial launch.

---

## Step 1 — Frontends on Vercel (do this first)

Import the repo **twice** (one Vercel project per app):

1. [vercel.com](https://vercel.com) → sign in with GitHub → **Add New → Project** → import `CryptoSodi/SirfBazar`.
   - **Root Directory: `apps/web`** (Edit → pick the folder). Framework auto-detects Next.js. Deploy.
2. **Add New → Project** → import the same repo again.
   - **Root Directory: `apps/admin`**. Framework auto-detects Vite (`apps/admin/vercel.json` handles SPA routing). Deploy.
3. Custom domains — per project, **Settings → Domains**:
   - web project: `sirfbazar.com` and `www.sirfbazar.com`
   - admin project: `admin.sirfbazar.com`
4. Cloudflare DNS (Vercel's Domains page shows exact targets; standard form):

   | Type | Name | Target | Proxy |
   |---|---|---|---|
   | A | `@` | `76.76.21.21` | DNS only (grey) |
   | CNAME | `www` | `cname.vercel-dns.com` | DNS only (grey) |
   | CNAME | `admin` | `cname.vercel-dns.com` | DNS only (grey) |

   Keep Vercel records **grey-cloud** — proxying them through Cloudflare causes
   redirect loops with Vercel's own TLS.

Every `git push` to `master` redeploys both projects automatically.

If you test via the `*.vercel.app` URL before DNS is set up, add that exact URL
to `CORS_ORIGINS` in `apps/api/.env` and restart the API.

---

## Step 2 — PostgreSQL on your machine (native)

1. Install from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) (version 16+). During setup you choose a password for the `postgres` superuser — remember it. Keep port 5432.
2. Create the database:
   ```powershell
   & "C:\Program Files\PostgreSQL\16\bin\createdb.exe" -U postgres sirfbazar
   ```
3. Put your password into `apps/api/.env`:
   ```
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/sirfbazar"
   ```
4. Create schema + demo data, then verify:
   ```powershell
   cd C:\repos\SirfBazar\apps\api
   npx prisma db push
   npm run seed
   npm run dev        # then: npm run smoke (in a second terminal) → 44 checks green
   ```

## Step 3 — Run the API permanently

```powershell
cd C:\repos\SirfBazar\apps\api
npm run build
npm run start:prod        # http://localhost:3001
```

Keep it alive across reboots with pm2:

```powershell
npm install -g pm2
pm2 start dist/main.js --name sirfbazar-api
pm2 save
```

(or a Task Scheduler job: trigger *At startup*, action `node dist\main.js`, start-in `apps\api`.)
Also disable Windows sleep — this machine is now the production server.

## Step 4 — Cloudflare Tunnel → api.sirfbazar.com

```powershell
winget install Cloudflare.cloudflared
cloudflared tunnel login                                      # pick the sirfbazar.com zone
cloudflared tunnel create sirfbazar-api                       # prints the tunnel UUID
cloudflared tunnel route dns sirfbazar-api api.sirfbazar.com  # creates the DNS record
```

Create `%USERPROFILE%\.cloudflared\config.yml`:

```yaml
tunnel: sirfbazar-api
credentials-file: C:\Users\<you>\.cloudflared\<TUNNEL-UUID>.json

ingress:
  - hostname: api.sirfbazar.com
    service: http://localhost:3001
  - service: http_status:404
```

Test, then install as a Windows service:

```powershell
cloudflared tunnel run sirfbazar-api    # test: https://api.sirfbazar.com/docs should load
cloudflared service install             # permanent, survives reboots
```

No port-forwarding or certificates needed — Cloudflare terminates TLS, and
WebSockets (live tracking) work through the tunnel out of the box.

---

## Mobile apps against production

```powershell
$env:EXPO_PUBLIC_API_URL = "https://api.sirfbazar.com/api"
npx expo start
```

## Go-live checklist

- [ ] Both Vercel projects deployed (root dirs `apps/web` and `apps/admin`)
- [ ] Custom domains attached + Cloudflare DNS records (grey-cloud)
- [ ] PostgreSQL installed, `DATABASE_URL` set, `db push` + `seed` done, smoke test green
- [ ] API running under pm2/Task Scheduler; PC sleep disabled
- [ ] Tunnel running as a service; `https://api.sirfbazar.com/api/products/categories` returns JSON
- [ ] Place a test order on `https://sirfbazar.com` end-to-end
- [ ] Real OTP provider: `OTP_PROVIDER=external` + provider keys (until then master code **123456** logs anyone in)
- [ ] Real Google login: `GOOGLE_AUTH_PROVIDER=google` + `GOOGLE_CLIENT_ID`
- [ ] Back up the local database periodically: `pg_dump -U postgres sirfbazar > backup.sql`
