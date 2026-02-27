# scripts

CLI scripts for seeding and importing data. Run via `pnpm <script>`.

## Entry points

- `seed.ts` — Seed tags + listings (Phase 1b). Requires DATABASE_URL, PAYLOAD_SECRET.
- `import-csv.ts` — Import tags/listings from CSV. Args: `--tags <file>`, `--listings <file>`, `--dry-run`.
- `import-address.ts` — Import by address or URL. Args: `--address "..."`, `--file addresses.txt`, `--sources trulia|zillow|zillow,trulia` (default: env `IMPORT_DEFAULT_SOURCES` or `trulia`), `--dry-run`, `--skip-photos`, `--skip-inference`, `--strict-sources` (fail on any source error), `--debug` (write per-address artifacts under `output/debug/{address-slug}/`: scraped.json, fetcher HTML, prompt.txt, photos/), `--delay-ms N` (batch delay, default 5000), `--force-refetch` (bypass scrape cache). Needs APIFY_TOKEN for Zillow source.

## Lib

- `lib/parse-tags-csv.ts`, `lib/parse-listings-csv.ts` — CSV parse + validate; return `RowResult<T>[]`.
- `lib/fetcher.ts` — `ScrapedProperty`, `ScrapedEvent`, `FetcherAdapter`, `AdapterMeta` interfaces; `FetchError` class with `FetchErrorCode` union.
- `lib/browser.ts` — Singleton stealth Chromium browser with retry, jitter, and challenge detection. Exports `fetchPageHtml()`, `closeBrowser()`.
- `lib/fetchers/index.ts` — Source registry with adapter metadata, `resolveAdapters(names)`, `mergeScraped(results)`, `getAdapterMeta(name)`. Add new adapters here.
- `lib/fetchers/zillow.ts` — Apify Zillow scraper + `ZillowAdapter`. Requires `APIFY_TOKEN`.
- `lib/fetchers/trulia.ts` — Full Trulia HTML scraper (cheerio) + `TruliaAdapter`. Throws typed `FetchError`. No API key needed; stability: fragile.
- `lib/infer-tags.ts` — Map scraped attribute strings → tag slugs.
- `lib/normalize.ts` — `normalizeToListing(scraped, tagIds)` → Payload listing shape.
- `lib/llm/schema.ts` — Zod inference + proposal schemas; `inferenceJsonSchema` for LLM response_format.
- `lib/llm/prompt.ts` — `buildSystemPrompt`, `buildUserPrompt`, `PROMPT_VERSION`.
- `lib/download-photos.ts` — `isTrustedPhotoUrl`, `downloadPhotos(listingSlug, …)`, `uploadPhotosToMedia`.
- `lib/apply-proposal.ts` — `applyProposal(listingId, currentTagIds, result, catalogSlugToId, payload, opts)`; slugify fallback, uses Payload `doc.slug`.
- `lib/ai-tag-inference.ts` — `InferenceInput`, `computeInputFingerprint` (SHA-256 of normalized input), `inferTags(provider, input, opts)`; when `opts.debug` is true (or CLI `--debug`), writes to current address debug dir (see `lib/debug.ts`): `prompt.txt`, `photos/photo-0.jpg`, … Logs elapsed timestamps at inference stages.
- `lib/debug.ts` — `getDebugMode()`, `setDebugMode(value)`, `getDebugAddressSlug()`, `setDebugAddressSlug(slug)`, `getDebugDir()`, `getAddressDebugDir()`. When debug is on and an address slug is set, artifacts go under `output/debug/{slug}/`: scraped.json (import-address), http.html/browser.html (Trulia), prompt.txt, photos/ (inference). Set slug at start of each address/listing; clear when done. Keeps batch output organized per address.

## Examples

- `examples/tags.csv`, `examples/listings.csv` — Sample CSV with header row.

## Patterns

- ESM; `dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })` then `getPayload({ config })` from `../src/payload.config`.
- Log prefixes: `[CREATED]`, `[SKIP]`, `[ERROR]`, `[DRY-RUN]`, `[FETCHED]`, `[BLOCKED]`, `[NOT_FOUND]`, `[CACHE]`, `[RETRY]`, `[WAIT]`, `[STATS]`.
- Scrape cache: `output/scrape-cache/{slug}.json` — bypass with `--force-refetch`.
