# SirfBazar shop local development copy

This folder is a copy of `C:\Users\mazha\OneDrive\Documents\SirfBazar\apps\shop`, made on 2026-09-29. The original SirfBazar repository remains the canonical source and is not automatically synchronized with this copy. The existing `sirfbazar-merchant-web` folder was not changed.

The `shared/design` files were copied from the original repository's `apps/shared/design` folder, and two import paths were adjusted so this copy can typecheck independently.

Development API: `http://localhost:3001/api` (from `.env.local`). Production API remains in `.env.production`. Open the frontend on port 5175, not the API port:

Double-click `start-frontend.cmd`, or run:

```powershell
cd "C:\Users\mazha\OneDrive\Documents\ChatGPT\Gorcery New Structure\sirfbazar-shop"
npm run dev -- --host 127.0.0.1 --port 5175 --strictPort
```

The copy passed `npx tsc --noEmit` on 2026-09-29. Its development toolchain was updated from Vite 6 / React plugin 4 to Vite 8 / React plugin 6 because the earlier esbuild-based config loader failed with `spawn EPERM` on this Windows/OneDrive path. After that update, `http://127.0.0.1:5175/` returned HTTP 200 with the `SirfBazar Merchant` page title. If the server is stopped or Windows restarts, use `start-frontend.cmd` to start it again.
