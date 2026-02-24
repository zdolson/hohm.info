# scripts

CLI scripts for seeding and importing data. Run via `pnpm <script>`.

## Entry points

- `seed.ts` — Seed tags + listings (Phase 1b). Requires DATABASE_URL, PAYLOAD_SECRET.
- `import-csv.ts` — Import tags/listings from CSV. Args: `--tags <file>`, `--listings <file>`, `--dry-run`.
- `import-address.ts` — Import by address: Zillow (Apify) + Trulia. Args: `--address "..."`, `--file addresses.txt`, `--dry-run`, `--skip-trulia`. Needs APIFY_TOKEN for Zillow.

## Lib

- `lib/parse-tags-csv.ts`, `lib/parse-listings-csv.ts` — CSV parse + validate; return `RowResult<T>[]`.
- `lib/fetcher.ts` — `ScrapedProperty`, `ScrapedEvent` interfaces.
- `lib/fetchers/zillow.ts` — Apify Zillow scraper.
- `lib/fetchers/trulia.ts` — Trulia HTML price history (cheerio).
- `lib/infer-tags.ts` — Map scraped attribute strings → tag slugs.
- `lib/normalize.ts` — `normalizeToListing(scraped, tagIds)` → Payload listing shape.

## Examples

- `examples/tags.csv`, `examples/listings.csv` — Sample CSV with header row.

## Patterns

- ESM; `dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })` then `getPayload({ config })` from `../src/payload.config`.
- Log prefixes: `[CREATED]`, `[SKIP]`, `[ERROR]`, `[DRY-RUN]`, `[FETCHED]`.
