# Grocerie.pk demo catalog

This imports public product names, categories, prices, and image URLs from [Grocerie.pk](https://www.grocerie.pk/products) into an **isolated local SirfBazar demo shop**. It does not download images or connect to the production database. The listings are a snapshot, not live merchant inventory; imported stock is a fixed test value of 20.

From the repository root:

```powershell
node tools/grocerie-scraper/scrape.mjs
cd apps/api
node --env-file=.env -r ts-node/register prisma/import-grocerie-demo.ts
```

The import rejects any database URL other than `localhost:5433/sirfbazar` (or `127.0.0.1`). It is idempotent and uses `grocerie-demo-` slugs, so existing catalog records are untouched. The JSON snapshot is ignored by Git; run the scraper again to refresh it. Source images remain hosted by Grocerie.pk's image provider and should be replaced or licensed before any non-local use.
