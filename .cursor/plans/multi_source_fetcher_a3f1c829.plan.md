---
name: Multi-Source Fetcher Adapter
overview: Refactor ingestion pipeline to support pluggable, CLI-selectable data sources. Replace hardcoded Zillow+Trulia logic with a FetcherAdapter interface, named source registry, and --sources CLI arg. Trulia becomes the default standalone source (no API keys). Zillow becomes optional (requires APIFY_TOKEN, throws if missing).
todos:
  - id: msa-1
    content: Add FetcherAdapter interface to scripts/lib/fetcher.ts
    status: completed
  - id: msa-2
    content: "Create scripts/lib/fetchers/index.ts: registry, resolveAdapters(), mergeScraped(), dedupeEvents()"
    status: completed
  - id: msa-3
    content: Add ZillowAdapter class to scripts/lib/fetchers/zillow.ts (APIFY_TOKEN guard + wrapper)
    status: completed
  - id: msa-4
    content: "Enhance scripts/lib/fetchers/trulia.ts: add fetchTrulia() for full property scrape + TruliaAdapter class"
    status: completed
  - id: msa-5
    content: "Update scripts/import-address.ts: --sources CLI arg, remove skipTrulia, use mergeScraped()"
    status: completed
  - id: msa-6
    content: "Update .env.example: add media.trulia.com to PHOTO_SOURCE_ALLOWLIST"
    status: completed
  - id: msa-7
    content: "Update scripts/CLAUDE.md: add fetchers/index.ts, update import-address flags"
    status: completed
isProject: false
---

# Multi-Source Fetcher Adapter

## Context

The ingestion pipeline (`scripts/import-address.ts`) was hardcoded: Zillow (Apify) as primary source, Trulia as a supplemental price-history-only augment. This broke without `APIFY_TOKEN` and made adding new sources (Realtor, county records) require editing core logic.

Goal: pluggable adapter per source, selectable via `--sources trulia` CLI arg. Trulia as the initial standalone POC — no API keys required.

---

## Design Decisions

1. **Trulia URL input** — if input contains `trulia.com/`, use directly; otherwise slugify to construct URL. If response is 404, throws with clear message: `Trulia 404 — try passing the URL directly: https://www.trulia.com/home/...`
2. **Merge priority** — explicit `SOURCE_PRIORITY = ["zillow", "trulia"]` (Zillow wins on scalar field conflicts; Trulia fallback). Events always union+dedupe.
3. **No stubs** — only register implemented adapters. `Unknown source: "realtor"` throws at startup.

---

## Interface

```ts
// scripts/lib/fetcher.ts
export interface FetcherAdapter {
  readonly name: string;
  fetch(input: string): Promise<ScrapedProperty>;
}
```

---

## Files Changed


| File                             | Change                                                                                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/lib/fetcher.ts`         | Added `FetcherAdapter` interface                                                                                                                         |
| `scripts/lib/fetchers/index.ts`  | NEW — registry, `resolveAdapters()`, `mergeScraped()`, `dedupeEvents()`                                                                                  |
| `scripts/lib/fetchers/zillow.ts` | Added `ZillowAdapter` class; updated error message to mention `--sources trulia`                                                                         |
| `scripts/lib/fetchers/trulia.ts` | Full rewrite — `fetchTrulia()` for complete property scrape; `TruliaAdapter`; `fetchTruliaHistory()` deprecated (delegates to `fetchTrulia()`)           |
| `scripts/import-address.ts`      | `--sources` CLI arg (default `trulia`); removed `skipTrulia`; deprecated `--skip-trulia` shim; replaced fetch logic with adapter loop + `mergeScraped()` |
| `.env.example`                   | Added `media.trulia.com` to `PHOTO_SOURCE_ALLOWLIST`                                                                                                     |
| `scripts/CLAUDE.md`              | Updated docs for new flags and new lib files                                                                                                             |


---

## Trulia Full Property Scrape

`fetchTrulia(input)` extracts:

- **Address** — from `<title>` (format: `"Street, City, ST Zip | ..."`) → falls back to structured data-testid elements → URL slug parsing
- **Price** — `[data-testid='property-price']` or `[class*='PriceLarge']`
- **Beds/baths/sqft** — `[data-testid='home-summary-*']` selectors
- **Facts** (yearBuilt, stories, lotSize, propertyType) — dl/dt→next(dd), table td pairs, `li` "Key: Value" items
- **rawAttributes** — heating, cooling, exterior, parking, pool, foundation, roof, sewer, water fact values
- **Status** — status badge or title text
- **Photos** — `meta[property="og:image"]` → gallery picture srcsets → `img[src*="media.trulia.com"]`
- **Description** — `[data-testid='description-text']` or `[class*='Description'] p`
- **listingEvents** — existing price history table scrape logic (unchanged)

---

## Adding a New Source

1. Create `scripts/lib/fetchers/{name}.ts` with a class implementing `FetcherAdapter`
2. Import and register it in `scripts/lib/fetchers/index.ts` `REGISTRY`
3. Add to `SOURCE_PRIORITY` array at desired merge priority

Planned future sources: `realtor`, `redfin`, `county`

---

## Verification

```bash
# Trulia standalone (no API keys)
pnpm import:address --address "https://www.trulia.com/home/408-w-king-st-owosso-mi-48867-122608427/" --sources trulia --dry-run

# Multi-source (no APIFY_TOKEN) → Zillow errors, Trulia fills all fields
pnpm import:address --address "..." --sources zillow,trulia --dry-run

# --skip-trulia deprecation warning
pnpm import:address --address "..." --skip-trulia --dry-run

# Unknown source throws at startup
pnpm import:address --address "..." --sources realtor
# Expected: Error: Unknown source: "realtor". Valid: zillow, trulia
```

