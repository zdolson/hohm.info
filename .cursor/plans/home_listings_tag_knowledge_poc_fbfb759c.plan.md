---
name: Home Listings Tag Knowledge PoC
overview: "Multi-phase plan and scaffold for a TypeScript/Next.js + Payload CMS site: home listings with deep tag knowledge (rich content, resources, categories). Single-tenant PoC on Supabase Postgres with comprehensive tests, analytics (PostHog), and caching for traffic spikes. No tenants in near term."
todos:
  - id: p0-init
    content: Init repo with pnpm + Next 15 (App Router) + TypeScript + src-dir. Or use `pnpm create payload-app@latest` with Postgres template and adjust.
    status: completed
  - id: p0-payload
    content: Install Payload 3 + @payloadcms/db-postgres. Create payload.config.ts with postgresAdapter (DATABASE_URL from env), secret, admin meta. Mount Payload admin at /admin and API at /api via (payload) route group.
    status: completed
  - id: p0-env
    content: Create .env.example with DATABASE_URL, PAYLOAD_SECRET, NEXT_PUBLIC_SERVER_URL placeholders. Add .env to .gitignore.
    status: completed
  - id: p0-getpayload
    content: Create src/lib/payload.ts — server-only getPayload() helper (singleton from config). Used by all server components.
    status: completed
  - id: p0-types
    content: Run `payload generate:types` to produce src/payload-types.ts. Document in README or add as postinstall script.
    status: completed
  - id: p0-vitest
    content: Install Vitest + @testing-library/react. Add vitest.config.ts. Create tests/ dir structure (unit/, integration/, e2e/). Add one smoke test.
    status: completed
  - id: p0-playwright
    content: Install Playwright. Add playwright.config.ts. Create tests/e2e/ with a minimal test that loads /admin.
    status: completed
  - id: p0-lint
    content: Ensure ESLint + Prettier are configured (Next.js default ESLint config is fine). Add lint script to package.json.
    status: completed
  - id: p0-migration-docs
    content: "Document migration workflow in README: push mode for dev, migrate for prod. Add scripts: `payload migrate:create`, `payload migrate`."
    status: completed
  - id: p0-verify
    content: "Verify: `pnpm dev` starts, /admin loads, Postgres connects, adding/removing a field + restart applies via push."
    status: completed
  - id: p1-users
    content: "Create Users collection (extend Payload default). Add `role` select field: admin | editor (homeowner added in Phase 7). Set access: read isAdminOrSelf, create/update/delete isAdmin."
    status: completed
  - id: p1-media
    content: "Create Media upload collection. Set mimeTypes (image/jpeg, image/png, image/webp, image/gif, application/pdf). Set maxFileSize. access: read public, write isAdmin."
    status: completed
  - id: p1-tags
    content: "Create Tags collection: name, slug (unique, validated), category (select: 12 categories — style/exterior/roofing/structure/systems/utilities/interior/parking/features/hazards/era/region), description (textarea), content (richText), resources (array: label/url validated/type), media (upload hasMany). access: read public, write isAdmin."
    status: completed
  - id: p1-listings
    content: "Create Listings collection: title, slug (unique, validated), address, city, state, region, yearBuilt, price, garageSpaces, groups (location, property, interior w/ bedrooms/bathroomsFull/bathroomsHalf/squareFootage/fireplaces, lot, financial), listingEvents array, summary, sourceUrl (validated), photos (upload array -> media), tags (relationship hasMany -> tags). All numerics min:0. access: read public, write isAdmin."
    status: completed
  - id: p1-seed
    content: Create scripts/seed.ts (run via tsx). Seed 3 tags (Brick Exterior, Knob-and-Tube Wiring, Slate Roof) + 2-3 Grand Rapids listings with tag relations. Add `seed` script to package.json.
    status: completed
  - id: p1-regen-types
    content: Re-run `payload generate:types` after adding collections. Verify generated types include Listing, Tag, Media, User interfaces.
    status: completed
  - id: p1-integration-tests
    content: "Write integration tests: create tag, create listing with tags, verify find returns correct data and relations. Test access control (public read, reject unauthenticated write)."
    status: completed
  - id: p1-verify
    content: "Verify: admin CRUD for all collections works, many-to-many listing<->tag works, media upload works, seed script runs."
    status: completed
  - id: p2-styling
    content: "Installed Panda CSS + Park UI (replaced planned Tailwind CSS 4). Created panda.config.ts with Park UI preset (ruby accent, olive gray), postcss.config.mjs, full theme system in src/theme/ (tokens, recipes, keyframes, conditions). Built component library in src/components/ui/ (14 components: badge, button, card, heading, icon, link, text, spinner, etc.)."
    status: completed
  - id: p2-rename-requireenv
    content: Rename `required()` to `requireEnv()` in src/payload.config.ts for clarity (env-specific name).
    status: completed
  - id: p2-layout
    content: Updated src/app/layout.tsx with nav (Home, Listings) + Panda CSS styling. Created (frontend) route group. globals.css uses Panda CSS layer directives.
    status: completed
  - id: p2-home
    content: Created src/app/(frontend)/page.tsx with landing (title + CTA to /listings). Removed old Payload default page.tsx.
    status: completed
  - id: p2-listings-index
    content: "Created src/app/(frontend)/listings/page.tsx: paginated listings via getPayload().find(), tag filter via ?tag=slug, listing cards with Panda CSS + Park UI components."
    status: completed
  - id: p2-listing-detail
    content: "Created src/app/(frontend)/listings/[slug]/page.tsx: all field groups (location, property, interior, lot, financial), listingEvents timeline, photos, tag chips linking to /tags/[slug] and /listings?tag=slug. Calls notFound() if missing."
    status: completed
  - id: p2-tag-page
    content: "Created src/app/(frontend)/tags/[slug]/page.tsx: name, category, description, richText content (Lexical), resources list, media. Calls notFound() if missing."
    status: completed
  - id: p2-posthog
    content: "Installed posthog-js. Created PostHogProvider + PostHogPageView (client-only). Wired into root layout. Env: NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST in .env.example. Page views tracked when key set."
    status: completed
  - id: p2-metadata
    content: Add generateMetadata to /listings/[slug] and /tags/[slug] for basic SEO (title, description from listing/tag data).
    status: completed
  - id: p2-notfound
    content: "Created src/app/not-found.tsx: heading, message, Home + Listings links (Panda CSS)."
    status: completed
  - id: p2-e2e
    content: "Added tests/e2e/frontend.spec.ts: home, listings index, listing detail (seed slug), tag page, tag filter URL, 404 for missing slug. Run pnpm test:e2e (requires seed + dev server)."
    status: completed
  - id: p2-verify
    content: "Manual: pnpm seed && pnpm dev, then pnpm test:e2e. Verify pages, tag filter, 404, pagination."
    status: pending
  - id: p3-search-builder
    content: "Create src/lib/search.ts: function that takes searchParams (tag, bedrooms, bathroomsFull, squareFootage, garageSpaces, propertyType, status, state, city, address) and returns a Payload `where` object. Use gte for numeric ranges, contains for address/city text, equals for state/status. Query nested interior.* and property.* where needed."
    status: pending
  - id: p3-filter-ui
    content: "Update /listings page: parse all search params, pass to search builder, use in payload.find(). Add basic filter form/controls (inputs/selects for bedrooms, bathroomsFull, state, city, propertyType, status, tag). URL-driven — form submits update query params."
    status: pending
  - id: p3-unit-tests
    content: "Write Vitest unit tests for search.ts: various param combos produce correct Payload where clauses. Edge cases: empty params, multiple tags, squareFootage range."
    status: pending
  - id: p3-e2e-filter
    content: "Write E2E tests: apply filters, verify URL updates, verify results change. Test combined filters."
    status: pending
  - id: p3-verify
    content: "Verify: filtering by all params works, URL is bookmarkable, results are correct, no regressions on existing pages."
    status: pending
  - id: p4-install-deps
    content: Install csv-parse (pnpm add csv-parse) and cheerio (pnpm add cheerio) for CSV import + Trulia HTML scraping.
    status: completed
  - id: p4-parse-tags-csv
    content: "Create scripts/lib/parse-tags-csv.ts: parse + validate tags.csv rows. Validate name/slug (regex /^[a-z0-9]+(?:-[a-z0-9]+)*$/), category (12-value enum), optional resources (JSON array: label/url/type). Return RowResult<TagRow>[] with ok rows + error rows carrying index + messages."
    status: completed
  - id: p4-parse-listings-csv
    content: "Create scripts/lib/parse-listings-csv.ts: parse + validate listings.csv rows. Map dot-notation columns to nested groups (location/property/interior/lot/financial). Parse tags column (comma-separated slugs). Parse listingEvents (JSON array column: {date,eventType,price?,source?,mlsNumber?}). Validate enums (propertyType, status, eventType), numerics (>= 0), sourceUrl (/^https?:\\/\\//). Return RowResult<ListingRow>[]."
    status: completed
  - id: p4-csv-script
    content: "Create scripts/import-csv.ts: CLI entry point. Args: --tags <file>, --listings <file>, --dry-run. Init Payload (dotenv.config + getPayload from seed.ts pattern). Import tags first (find-by-slug, skip if exists). Build slug->id map. Import listings (resolve tag slugs to IDs, skip if slug exists). Log [CREATED]/[SKIP]/[WARN]/[DRY-RUN]/[ERROR] per row. Print summary. Exit 1 on any errors."
    status: completed
  - id: p4-csv-examples
    content: "Create scripts/examples/tags.csv (3+ rows across categories, one with resources JSON) and scripts/examples/listings.csv (2 rows: one full with listingEvents JSON, one minimal). Column header row documents all columns."
    status: completed
  - id: p4-fetcher-interface
    content: "Create scripts/lib/fetcher.ts: TypeScript interface ScrapedProperty { title?, address, city, state, zipCode?, county?, yearBuilt?, price?, beds?, bathsFull?, bathsHalf?, sqft?, lotSize?, stories?, propertyType?, status?, garageSpaces?, fireplaces?, annualTaxes?, taxYear?, listingEvents: ScrapedEvent[], rawAttributes: string[], sourceUrl? } and ScrapedEvent { date, eventType, price?, source?, mlsNumber? }."
    status: completed
  - id: p4-zillow-fetcher
    content: "Create scripts/lib/fetchers/zillow.ts: fetchZillow(address: string): Promise<ScrapedProperty>. Use Apify REST API (actor maxcopell/zillow-scraper; APIFY_TOKEN from env). POST run-sync-get-dataset-items, extract first result. Map Zillow fields (Bedrooms, BathroomsFull, LivingArea, LotAreaValue, YearBuilt, Stories, GarageSpaces, Heating, Flooring, RoofType, Description, MlsId, PriceHistory array) to ScrapedProperty. Populate rawAttributes from Heating/Flooring/RoofType/Foundation/Sewer/Exterior strings."
    status: completed
  - id: p4-trulia-fetcher
    content: "Create scripts/lib/fetchers/trulia.ts: fetchTruliaHistory(address: string): Promise<ScrapedEvent[]>. Build Trulia URL from address. Fetch HTML (native fetch). Parse price history table with cheerio: extract date, event label, price rows. Map labels: 'Listed For Sale'->listed, 'Price Change'->priceChange, 'Pending'->pending, 'PendingToActive'->active, 'Sold'->sold, 'Listed For Rent'->listedForRent, 'Listing Removed'->listingRemoved."
    status: completed
  - id: p4-tag-inference
    content: "Create scripts/lib/infer-tags.ts: ATTRIBUTE_TAG_MAP constant mapping scraped attribute strings to tag slugs (e.g. 'forced air'->forced-air-heating, 'brick'->brick-exterior, 'wood siding'->wood-exterior, 'knob and tube'->knob-and-tube-wiring, 'full basement'->full-basement, 'hardwood'->hardwood-floors, 'asphalt shingle'->asphalt-shingle, 'natural gas'->natural-gas, 'attached garage'->attached-garage, etc.). inferTagSlugs(attrs: string[]): string[] — lowercase each attr, test against map keys (substring match), return matched slugs. Log unmatched attrs."
    status: completed
  - id: p4-normalize
    content: "Create scripts/lib/normalize.ts: normalizeToListing(scraped: ScrapedProperty, tagIds: number[]): ListingCreateData. Map ScrapedProperty to Payload Listing shape (groups: location, property, interior, lot, financial), listingEvents array, tags as IDs. Derive slug: slugify(address + '-' + city + '-' + state) — lowercase, replace non-alphanumeric with hyphens, dedupe hyphens. Title defaults to address string."
    status: completed
  - id: p4-import-address-script
    content: "Create scripts/import-address.ts: CLI entry. Args: --address 'Street, City, ST' (repeatable), --file addresses.txt (one address per line), --dry-run, --skip-trulia. For each address: fetchZillow -> (unless --skip-trulia) fetchTruliaHistory -> merge events -> inferTagSlugs -> resolve slugs to IDs (payload.find; create missing tags with overrideAccess:true) -> normalizeToListing -> find-or-skip by slug -> payload.create(overrideAccess:true). Print per-address [FETCHED]/[CREATED]/[SKIP]/[ERROR]. Summary + exit 1 on errors."
    status: completed
  - id: p4-package-scripts
    content: "Add to package.json scripts: 'import-csv': 'tsx scripts/import-csv.ts', 'import-address': 'tsx scripts/import-address.ts'. Add APIFY_TOKEN placeholder to .env.example."
    status: completed
  - id: p4-verify
    content: "Verify CSV path: pnpm import-csv --tags scripts/examples/tags.csv --dry-run (no writes, correct log). Real import + re-run (idempotent). Verify address path: pnpm import-address --address '2115 Anderson Dr SE, East Grand Rapids, MI' --dry-run; then real import. Check admin UI: all fields, groups, listingEvents, and tag relations populated correctly."
    status: pending
  - id: p5-isr
    content: Add revalidate config to /listings and /listings/[slug] pages (e.g. revalidate = 60). Test that pages serve from cache on repeated loads.
    status: pending
  - id: p5-invalidation
    content: Add afterChange hook to Listings collection that calls revalidatePath/revalidateTag to bust cache on admin edits. Document cache TTLs and strategy.
    status: pending
  - id: p5-verify
    content: "Verify: pages cache correctly, admin edits trigger revalidation, document cache strategy in README."
    status: pending
  - id: p6-inline-tags
    content: "On /listings/[slug], render each tag inline: accordion/card per tag grouped by category. Show description + resources (clickable links, YouTube embeds or external). Truncate richText content with 'read more' link to /tags/[slug]."
    status: pending
  - id: p6-verify
    content: "Verify: listing detail shows tag knowledge inline, resources are clickable, content is truncated, no extra API calls (uses depth:1 data), page remains fast."
    status: pending
  - id: p7-user-role
    content: "Add 'homeowner' option to Users role field. Enable self-registration on Users collection. Add beforeChange hook: force role='homeowner' on self-registration, prevent setting role to admin/editor."
    status: pending
  - id: p7-homerecords
    content: "Create HomeRecords collection: owner (relation Users, required), listing (relation Listings, optional), title, notes (richText). Access: read/update/delete owner-only via where constraint, create authenticated+homeowner."
    status: pending
  - id: p7-homerecord-docs
    content: "Create HomeRecordDocuments upload collection: record (relation HomeRecords), label, documentType (select: receipt/inspection/photo/permit/other), date, notes. mimeTypes: image/*, application/pdf. Access: inherit from parent record owner."
    status: pending
  - id: p7-access-tests
    content: "Write integration tests: homeowner can only read/write own records; cannot access other users' records; admin cannot see homeowner records; self-registration forces homeowner role; privilege escalation is blocked."
    status: pending
  - id: p7-add-to-config
    content: Add HomeRecords + HomeRecordDocuments to payload.config.ts collections array. Re-run generate:types.
    status: pending
  - id: p7-verify
    content: "Verify: homeowner sign-up works, CRUD on records works, access control is airtight, documents upload works."
    status: pending
  - id: sec-users-access
    content: "Audit Users collection access: read must be isAdminOrSelf (not public). Verify create hook prevents privilege escalation."
    status: pending
  - id: sec-upload-config
    content: Verify mimeTypes + maxFileSize set on Media and HomeRecordDocuments. Ensure HomeRecordDocuments uses private storage (signed URLs when on S3).
    status: pending
  - id: sec-cors
    content: Set cors in payload.config.ts to known origins for production (env-driven). Use '*' only in dev.
    status: pending
  - id: sec-env-audit
    content: "Audit .env: ensure DATABASE_URL, PAYLOAD_SECRET, S3_* are NOT prefixed NEXT_PUBLIC_. Verify .env is in .gitignore."
    status: pending
  - id: sec-document
    content: "Add SECURITY.md or section in README documenting: rate limiting (production), CSP headers, pnpm audit, backup strategy, HTTPS requirement."
    status: pending
isProject: false
---

# Home Listings + Deep Tag Knowledge — PoC Plan & Scaffold

---

## 1. Multi-phase plan

### Phase 0: Repo bootstrap + DX + migration workflow

**Goals:** Working Next.js (App Router) + Payload embedded, pnpm, Postgres (Supabase), local dev and deployable shape. **Schema must support frequent early migrations** as the data shape is hammered out.

**User stories:** As a dev I can `pnpm install && pnpm dev` and reach `/` and `/admin`; DB connects via `DATABASE_URL`. As a dev I can change collection fields and apply schema changes without friction.

**Key deliverables:**

- `package.json` (pnpm), Next 15, Payload 3, `@payloadcms/db-postgres`
- `payload.config.ts` with Postgres adapter, admin at `/admin`
- `.env.example` with `DATABASE_URL`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL`
- ESLint/Prettier (optional, minimal), `payload generate:types` in postinstall or docs
- **Migrations:** Use Payload + Drizzle **push** in development (auto-sync schema from config; ideal for frequent changes). Use **migrate** for production and when schema stabilizes. Document: `pnpm payload migrate:create` / `pnpm payload migrate`; avoid mixing push and migrate in same branch. Keep migrations in version control; reversible where possible.

**Acceptance criteria:** `pnpm dev` runs; `/admin` loads; no Prisma (Payload adapter only). Adding/removing a field and restarting dev applies changes (push) or a new migration is generated.

**Out of scope:** Collections (Phase 1), public pages, CI/CD, PostHog (Phase 2).

---

### Phase 1: Data model + admin UI (Listings, Tags, Media)

**Goals:** Editors manage Listings, Tags (with knowledge content), and Media via Payload admin. Listings include **searchable attributes** (bedrooms, bathroomsFull, squareFootage, garageSpaces, propertyType, status, state, city, address) for Phase 3 search.

**User stories:**

- Create/edit listings (address, city, state, location, year, price, interior: bedrooms/bathroomsFull/squareFootage, garage, listingEvents, property: status/propertyType, summary, photos, tags, source URL).
- Create/edit tags (name, slug, category, description, rich text, resources array, media). Tags are at least **filterable** on listings; optional tag landing page TBD.
- Upload media; attach to listings and tags.

**Key endpoints/pages:** Payload REST/Admin: `POST/GET/PATCH /api/listings`, `/api/tags`, `/api/media`, `/api/users`.

**Data model (high level):**

- **Users** — Payload default; roles (e.g. `admin`, `editor`) for future.
- **Tags** — `name`, `slug`, `category` (select or text), `description` (textarea), `content` (richText), `resources` (array: `{ label, url, type }`), `media` (upload relation). Used as filterable facets; optional dedicated tag page later.
- **Listings** — `title`, `slug`, `address`, `city`, `state`, `region` (optional), `yearBuilt`, `price` (optional), groups: location (zipCode, county), property (propertyType, status, stories), interior (bedrooms, bathroomsFull, bathroomsHalf, squareFootage, fireplaces), lot (lotSize), financial (annualTaxes, taxYear); `listingEvents` array; `garageSpaces`, `summary`, `sourceUrl`, `photos` (upload array), `tags` (relationship many-to-many). Descriptive garage details modeled as tags.
- **Media** — Payload upload collection (local by default; Supabase S3 optional later).

**Acceptance criteria:** Admin CRUD for all; many-to-many listing–tag; tag has rich text + resources; media upload works. Listings have bedrooms/bathroomsFull/squareFootage/state/city/address (and listingEvents) for search/display.

**Out of scope:** Public site, search UI, background jobs.

---

### Phase 2: Public site (listings index, detail; tags as filterable, optional tag page)

**Goals:** Public read-only pages: home, listings list, listing detail. **Tags are at least filterable** (e.g. chips/links that apply `?tag=slug`). Optional: dedicated tag knowledge page `/tags/[slug]` if product decision is to have tag landing pages.

**Prerequisites / setup (completed):**

- **Panda CSS + Park UI** installed instead of Tailwind CSS 4. Full theme system in `src/theme/` with tokens, recipes, keyframes. Component library in `src/components/ui/` (badge, button, card, heading, icon, link, text, spinner, etc.). Config: `panda.config.ts`, `postcss.config.mjs`.
- `**requireEnv()` already renamed in `src/payload.config.ts`.
- **Route groups:** `(payload)` for admin, `(frontend)` for public routes. Root layout updated with nav.
- **Seeded data:** `pnpm seed` seeds 3 listings + 22 tags.
- **Husky + lint-staged** added for pre-commit formatting.

**User stories:** Visitor sees listing list and detail; each listing shows tags as filterable chips (and optionally links to tag knowledge). If tag pages exist: visitor can open a tag and see rich content and resources.

**Key pages:**

- `/` — Basic landing (title, CTA to listings). File: `src/app/(frontend)/page.tsx`.
- `/listings` — List of listings; filter by `?tag=slug`. File: `src/app/(frontend)/listings/page.tsx`.
- `/listings/[slug]` — Listing detail: all field groups (location, property, interior, lot, financial) + listingEvents timeline + photos + tag chips. File: `src/app/(frontend)/listings/[slug]/page.tsx`.
- `/tags/[slug]` — Tag knowledge hub: name, category, description, rich content (Lexical), resources, media. File: `src/app/(frontend)/tags/[slug]/page.tsx`.

**Data access pattern:** Import `getPayload` from `@/lib/payload` (server-only singleton). Use `payload.find()` / `payload.findByArgs()` in Server Components. Use `depth: 1` to resolve tag relations on listings.

**Acceptance criteria:** All pages render with data from Payload; listing detail shows tags; filtering by tag works; tag page shows full knowledge content; 404 for missing slug. Listing index is paginated.

**Status:** Core pages implemented. Remaining: PostHog analytics (deferred), E2E tests, global not-found.tsx, final verification.

**Out of scope:** Full search/filter UI (Phase 3), SEO sitemap, auth for public.

---

### Phase 3: Search + filtering

**Goals:** Search/filter by **listing attributes** (bedrooms, bathroomsFull, squareFootage, garageSpaces, propertyType, status, state, city, address) and by **tags**. URL-driven (query params); no separate search engine required for MVP.

**User stories:** Visitor filters listings by tag(s), and by bedrooms, bathroomsFull, squareFootage range, propertyType, status, state, city, address (text search), and optionally garage (field or tag).

**Key implementation:**

- Listings already have: interior (bedrooms, bathroomsFull, squareFootage), property (status, propertyType), garageSpaces, state, city, address (Phase 1b).
- Query params: e.g. `/listings?tag=slug&bedrooms=3&bathroomsFull=2&state=MI&city=Grand+Rapids&address=...`. Build Payload `where` from params (e.g. `and([ tags.slug.equals, interior.bedrooms.equals, property.status.equals, ... ])`). Optional: full-text or `contains` on `address`/`city` for "search by address".
- Garage: `garageSpaces` (number, 0+) on Listings for numeric filtering (>= N); descriptive aspects (e.g. "detached garage", "carport") as tags.

**Acceptance criteria:** Filter by tag(s) and by bedrooms/bathroomsFull/squareFootage/state/city/address/propertyType/status works; URL reflects filters; results update correctly.

**Out of scope:** External search engine (Meilisearch/Typesense), ranking, complex full-text in MVP.

---

### Phase 4: Ingestion — CSV import + address-based scraping pipeline

**Goals:** Two ingestion paths: (1) CSV import for manual/bulk data entry; (2) address-based scraping pipeline (address → Zillow/Trulia scrape → normalize → Payload ingest) for automated at-scale population. The address pipeline is the primary path for bulk feeding; CSV is the fallback.

**User stories:**

- Admin bulk-imports listings + tags from a CSV file with validation and dry-run preview.
- Admin provides one or more addresses; script fetches property data from Zillow (via Apify) and price history from Trulia, infers tags from scraped attributes, and creates listings in the DB.
- Both paths skip existing slugs (idempotent); both support `--dry-run` to preview without writing.

---

#### Track A: CSV Import

**Files:**

| File                                | Purpose                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `scripts/lib/parse-tags-csv.ts`     | Parse + validate tags.csv rows; return `RowResult<TagRow>[]`                  |
| `scripts/lib/parse-listings-csv.ts` | Parse + validate listings.csv rows; map dot-notation columns to nested groups |
| `scripts/import-csv.ts`             | CLI entry: `--tags`, `--listings`, `--dry-run`                                |
| `scripts/examples/tags.csv`         | Example with 3+ rows, resources JSON                                          |
| `scripts/examples/listings.csv`     | Example: one full row (listingEvents JSON), one minimal                       |

**tags.csv format:**

```csv
name,slug,category,description,resources
Brick Exterior,brick-exterior,exterior,Solid fired-clay brick.,"[{""label"":""Guide"",""url"":""https://example.com"",""type"":""guide""}]"
```

Valid categories: `style` `exterior` `roofing` `structure` `systems` `utilities` `interior` `parking` `features` `hazards` `era` `region`

**listings.csv format** (dot-notation columns for nested groups):

```
title, slug, address, city, state, region, yearBuilt, price, garageSpaces, summary, sourceUrl,
location.zipCode, location.county,
property.propertyType, property.status, property.stories,
interior.bedrooms, interior.bathroomsFull, interior.bathroomsHalf, interior.squareFootage, interior.fireplaces,
lot.lotSize, financial.annualTaxes, financial.taxYear,
tags (comma-separated slugs), listingEvents (JSON array)
```

Valid `property.propertyType`: `singleFamily` `condo` `townhouse` `multiFamily` `land` `mobileHome`
Valid `property.status`: `active` `pending` `sold` `offMarket`
Valid `listingEvents[].eventType`: `listed` `priceChange` `pending` `active` `sold` `listedForRent` `listingRemoved`

**CLI log format:**

```
[ERROR]   Row 3 (tags.csv): slug "bad slug" is invalid
[SKIP]    Row 5 (listings.csv): slug "123-main-st" already exists
[WARN]    Row 7 (listings.csv): tag slug "unknown-tag" not found — skipping
[DRY-RUN] Would create tag: brick-exterior (exterior)
[CREATED] listing: 123-heritage-ave
Summary: 2 tags created (1 skipped, 1 error) | 1 listing created (0 skipped)
```

**Conflict strategy:** skip-on-slug-exists (idempotent). `overrideAccess: true` on all Payload writes. Exit 1 if any parse or write errors.

**Usage:**

```bash
pnpm import-csv --tags scripts/examples/tags.csv --dry-run
pnpm import-csv --tags scripts/examples/tags.csv --listings scripts/examples/listings.csv
```

---

#### Track B: Address-Based Scraping Pipeline

**Architecture:** address → Zillow (Apify) → Trulia HTML → inferTagSlugs → normalize → Payload

**Files:**

| File                             | Purpose                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `scripts/lib/fetcher.ts`         | `ScrapedProperty` + `ScrapedEvent` TypeScript interfaces                         |
| `scripts/lib/fetchers/zillow.ts` | `fetchZillow(address): Promise<ScrapedProperty>` via Apify                       |
| `scripts/lib/fetchers/trulia.ts` | `fetchTruliaHistory(address): Promise<ScrapedEvent[]>` via HTML scrape + cheerio |
| `scripts/lib/infer-tags.ts`      | `inferTagSlugs(attrs: string[]): string[]` — maps raw attributes to tag slugs    |
| `scripts/lib/normalize.ts`       | `normalizeToListing(scraped, tagIds): ListingCreateData`                         |
| `scripts/import-address.ts`      | CLI entry: `--address`, `--file`, `--dry-run`, `--skip-trulia`                   |

`**ScrapedProperty` interface:

```ts
interface ScrapedProperty {
  title?: string;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  county?: string;
  yearBuilt?: number;
  price?: number;
  beds?: number;
  bathsFull?: number;
  bathsHalf?: number;
  sqft?: number;
  lotSize?: number;
  stories?: number;
  propertyType?: string;
  status?: string;
  garageSpaces?: number;
  fireplaces?: number;
  annualTaxes?: number;
  taxYear?: number;
  listingEvents: ScrapedEvent[];
  rawAttributes: string[]; // e.g. ['Forced Air', 'Brick', 'Full Basement', 'Knob and Tube']
  sourceUrl?: string;
}
```

**Zillow fetcher (Apify):**

- Actor: `maxcopell/zillow-scraper` (or `petr_cermak/zillow-api-scraper`)
- Endpoint: `POST https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items?token={APIFY_TOKEN}`
- Input: `{ "searchUrls": [{ "url": "https://www.zillow.com/homes/{encoded-address}_rb/" }] }`
- Map fields: `Bedrooms`, `BathroomsFull`, `BathroomsHalf`, `LivingArea`, `LotAreaValue`, `YearBuilt`, `Stories`, `GarageSpaces`, `Heating`, `Flooring`, `RoofType`, `Description`, `MlsId`, `MlsSource`, `Price`, `HomeStatus`, `PriceHistory[]`
- `rawAttributes` = join Heating + Flooring + RoofType + Foundation + Exterior + Sewer fields
- `listingEvents` = map `PriceHistory` array (event types: `Listed For Sale`, `Sold`, `Price Change`, etc.)

**Trulia fetcher (HTML):**

- Search URL: `https://www.trulia.com/home/{slugified-address}/`
- Fetch HTML with `native fetch` (Node 18+)
- Parse with `cheerio`: find price history table rows
- Map Trulia event labels to Payload eventType enum values
- Merge with Zillow events (dedupe by date+eventType)

**Tag inference map (subset):**

| Scraped attribute (substring match, case-insensitive) | Tag slug             |
| ----------------------------------------------------- | -------------------- |
| forced air                                            | forced-air-heating   |
| brick                                                 | brick-exterior       |
| wood siding                                           | wood-exterior        |
| asphalt shingle                                       | asphalt-shingle      |
| full basement                                         | full-basement        |
| hardwood                                              | hardwood-floors      |
| tile                                                  | tile-flooring        |
| knob and tube                                         | knob-and-tube-wiring |
| natural gas                                           | natural-gas          |
| public water                                          | public-water         |
| public sewer                                          | public-sewer         |
| attached garage                                       | attached-garage      |
| side-facing garage                                    | side-facing-garage   |
| fireplace                                             | fireplace            |
| fenced                                                | fenced-yard          |
| ranch                                                 | ranch                |
| victorian                                             | victorian            |

Unmatched attributes: log as `[WARN] No tag for attribute: "Copper Plumbing"`.

**Slug derivation:**

```ts
slugify(`${address}-${city}-${state}`)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");
```

**Missing tag handling:** If inferred tag slug doesn't exist in DB, `payload.create` the tag with `name` derived from slug, `category: 'features'` as fallback. Log `[CREATED TAG] fireplace`.

**Usage:**

```bash
pnpm import-address --address "2115 Anderson Dr SE, East Grand Rapids, MI"
pnpm import-address --file addresses.txt --dry-run
pnpm import-address --address "408 W King St, Owosso, MI" --skip-trulia
```

`addresses.txt` format: one address per line, `Street, City, ST`.

---

#### Shared: `package.json` additions

```json
"import-csv": "tsx scripts/import-csv.ts",
"import-address": "tsx scripts/import-address.ts"
```

`.env.example` addition:

```env
# Phase 4: Apify (Zillow scraper)
# APIFY_TOKEN=apify_api_...
```

---

#### Dependencies

```bash
pnpm add csv-parse cheerio
```

`csv-parse` — ESM-native CSV parser.
`cheerio` — server-side HTML parsing for Trulia scrape.

---

#### Acceptance criteria

- CSV import creates correct listings + tags; idempotent on re-run; dry-run logs correctly; invalid rows reported with row number and field; exit 1 on errors.
- Address import fetches real data from Zillow (with valid `APIFY_TOKEN`), merges Trulia history, infers tags, creates listing with correct groups + events; idempotent; dry-run works.
- Both scripts document usage in `README.md` or `docs/import.md`.

---

#### Out of scope

- Photo import (requires upload; use admin UI)
- Tag `content` (richText/Lexical) via CSV — plain `description` only
- Update/patch existing records (skip strategy only)
- Full ETL pipeline / job queue
- Streaming for very large files (sync parse sufficient for PoC)

---

### Phase 5: Caching (traffic spikes)

**Goals:** Protect against massive traffic spikes; avoid overloading Postgres and Payload.

**User stories:** Under high load, public listing list/detail and tag pages (if any) are served from cache where possible; cache invalidation is manageable.

**Key implementation:**

- **Next.js:** Use **fetch cache** or **React cache** for Payload reads in Server Components (e.g. `next: { revalidate: 60 }` or segment-level config). Consider **ISR** for `/listings` and `/listings/[slug]` with revalidate.
- **Optional:** Redis or Vercel KV for caching serialized listing list/detail responses if Next.js cache is insufficient; add invalidation on admin create/update (webhook or manual).
- Document cache TTLs and invalidation strategy (e.g. on publish/update in admin).

**Acceptance criteria:** Listings index and detail (and tag page if present) can be served from cache; strategy for invalidation is documented and applied.

**Out of scope:** Edge caching CDN config (can layer later); caching of admin API.

---

### Phase 6: Tag-enriched listing detail

**Goals:** Embellish `/listings/[slug]` with inline knowledge content pulled from the listing's attached tags. Visitors get contextual education (e.g. what "knob-and-tube wiring" means, repair cost notes, YouTube tours) without leaving the listing page.

**User stories:** Visitor views a listing and sees expandable/inline sections for each tag: description, key resources, and optionally rich content excerpt. Visitor can click through to the full `/tags/[slug]` page for deeper reading.

**Key implementation:**

- On listing detail, iterate `listing.tags` (already resolved at `depth: 1`); render each tag's `description` + `resources` inline (e.g. accordion or card per tag).
- Optionally render a truncated `content` (richText) excerpt with "read more" link to `/tags/[slug]`.
- Order tags by category grouping (style, exterior, roofing, structure, systems, utilities, interior, parking, features, hazards, era, region) for scannability.
- No new collections or API changes; purely a rendering enhancement on an existing page.

**Acceptance criteria:** Listing detail shows tag knowledge inline; resources render as clickable links (YouTube opens embed or external); content is truncated with link to full tag page. Page remains fast (no extra Payload calls if depth already resolves tags).

**Out of scope:** Editable tag content from public side; AI-generated summaries.

---

### Phase 7: Private home records ledger

**Goals:** Scaffold a private, per-user "managed home record" — a homeowner's personal ledger of documents, notes, and history for a home. Relates to a Listing (optional; supports future record transfer). Includes uploaded documents (scans, receipts, inspection reports).

**Data model:**

- **Users** — Add `role` field: `admin | editor | homeowner`. Homeowner role allows public sign-up (self-registration). Paid features gated by role or subscription flag later.
- **HomeRecords** — `owner` (relation to Users, required), `listing` (relation to Listings, optional — a listing can have multiple records from different owners), `title` (e.g. "123 Wealthy St Record"), `notes` (richText), `createdAt`, `updatedAt`. Access: only owner can read/write their own records.
- **HomeRecordDocuments** — Upload collection: `record` (relation to HomeRecords), `file` (upload), `label` (text), `documentType` (select: receipt, inspection, photo, permit, other), `date` (date, optional — when the document is from), `notes` (textarea, optional). Access: only the parent record's owner can read/write. Future: AI pipeline processes these into timeline/summary.

**Key points:**

- A Listing can have 0..N HomeRecords (previous owner keeps theirs; new owner starts fresh).
- Record transfer (future): change `owner` field + audit log; only current owner can initiate.
- Public sign-up: Payload `auth` on Users collection with self-registration enabled for `homeowner` role. Admin/editor creation remains admin-only.
- Documents are initially scanned photos/receipts; stored via Payload uploads (local or S3).

**User stories:**

- Homeowner signs up, creates a HomeRecord (optionally linked to a listing).
- Homeowner uploads documents (receipts, inspection reports) to their record.
- Homeowner views their record: notes, documents list, document details.
- Admin cannot see homeowner records (unless explicitly granted).

**Key pages (future):**

- `/my/records` — List of homeowner's records (auth-gated).
- `/my/records/[id]` — Record detail: notes, documents, timeline (future).
- `/my/records/[id]/upload` — Upload document to record.

**Acceptance criteria:** HomeRecords and HomeRecordDocuments collections exist; access control enforces owner-only read/write; homeowner can self-register; basic CRUD via admin or API. Pages can be deferred; API + access control is the priority.

**Out of scope:** AI document processing, timeline generation, paid feature gating, record transfer UX, email verification (can add later).

---

### Security

**Goals:** Document and mitigate security concerns across all phases.

**Payload API exposure:**

- Payload REST API is public at `/api/`. Collections with `read: () => true` (Listings, Tags, Media) are intentionally public. **Users collection must NOT have public read** — restrict: `read: ({ req }) => req.user?.role === 'admin'` (or similar). Default Payload Users collection has `read: isAdminOrSelf`; verify this is applied.
- `create` on Users: if self-registration is enabled for homeowners, restrict to only creating `homeowner` role. A `beforeChange` hook should force `role: 'homeowner'` on self-registration and prevent privilege escalation (user cannot set their own role to `admin`).
- `update/delete` on all collections: require `isAdmin` or ownership check.

**Authentication:**

- `PAYLOAD_SECRET` must be a strong random string (min 32 chars). Rotate if compromised.
- Payload uses HTTP-only cookies for session; CSRF is mitigated by same-site cookie policy. Verify `sameSite: 'lax'` or `'strict'` in production.
- Rate limiting on `/api/users/login` and `/api/users` (registration): not built into Payload. Add at reverse proxy (nginx, Caddy) or Next.js middleware. Document as a production hardening step.

**Environment variables:**

- `DATABASE_URL`, `PAYLOAD_SECRET`, `S3_` keys must NEVER be prefixed with `NEXT_PUBLIC_`. Only `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` are safe for client exposure.
- `.env` must be in `.gitignore`. `.env.example` contains placeholders only.

**File uploads (Media, HomeRecordDocuments):**

- Set explicit `mimeTypes` on upload collections (e.g. `image/jpeg`, `image/png`, `application/pdf`). Reject unexpected file types.
- Set `maxFileSize` (e.g. 10MB for images, 25MB for documents).
- Payload stores files on disk (local adapter) or S3. Local adapter: ensure upload directory is not web-accessible outside Payload's serving. S3: use private bucket + signed URLs for HomeRecordDocuments (private files); public bucket for Media (public images).

**HomeRecords access control:**

- `read`: `({ req }) => ({ owner: { equals: req.user?.id } })` — returns a `where` constraint so Payload filters at query level. No data leaks even via API.
- `create`: authenticated + role is `homeowner` or `admin`.
- `update/delete`: owner only.
- HomeRecordDocuments: inherit access from parent HomeRecord's owner. Access function: look up the parent record's `owner` and compare to `req.user.id`.

**XSS / richText:**

- Payload richText stores structured JSON (Slate/Lexical), not raw HTML. Rendered via Payload's serializer — low XSS risk. If you ever render raw HTML, sanitize with DOMPurify or similar.

**CORS:**

- In production, set `cors` in Payload config to your known origins only (e.g. `['https://hohm.info']`). Do not use `'*'` in production.

**SQL injection:**

- Payload + Drizzle uses parameterized queries. Risk is negligible unless you write raw SQL. Avoid `sql\`...` with user-interpolated strings.

**Production hardening checklist (not in PoC, but document):**

- HTTPS everywhere (handled by host / reverse proxy).
- Rate limiting on auth endpoints.
- CSP headers (Content-Security-Policy) via Next.js middleware or `next.config.ts`.
- Dependency auditing (`pnpm audit`).
- Log monitoring for failed auth attempts.
- Backup strategy for Supabase Postgres.

---

### Testing (cross-phase)

**Goals:** **Comprehensive tests** so changes are safe and regressions are caught.

**Scope:**

- **Unit:** Pure functions (e.g. search/filter query builders, formatters) and utilities. Use **Vitest** (ESM-native, fast, aligns with Next/Payload ecosystem).
- **Integration:** Payload operations (create/update/find) against a test DB or Payload's test utilities. Seed test data; assert on listing/tag CRUD and relations.
- **E2E:** Critical paths: load `/`, `/listings`, `/listings/[slug]`, apply filter; optional: admin login and create listing. Use Playwright (or Cypress). Run in CI.
- **Coverage:** Aim for high coverage on core domain (listings, tags, search params to Payload `where`); don't require 100% on UI.

**When:** Add test harness in Phase 0 (Vitest + Playwright). Phase 1: integration tests for collections and access. Phase 2: E2E for public pages. Phase 3: tests for filter/search logic. Keep tests green as part of each phase's definition of done.

---

### Analytics (PostHog)

**Goals:** Product analytics and optional feature flags; understand usage and support iteration.

**Recommendation:** **PostHog** — self-hostable or cloud, events + page views, session replay, feature flags, and (optionally) A/B tests. Fits "slim budget" (generous free tier) and doesn't require a separate backend.

**Alternatives (brief):** Vercel Analytics (simple page views, no replay); Plausible/Umami (privacy-focused, lightweight); Mixpanel (strong product analytics, less focus on replay). PostHog is a good default unless you need minimal script size or strict privacy-only tooling.

**Implementation:** Add PostHog provider (`posthog-js` + a client-only `PostHogProvider` wrapper component) in root layout; send page views and custom events (e.g. "filter_applied", "listing_viewed"). Env: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`. **Add in Phase 2** alongside first public pages.

---

## 2. Architecture decisions

| Topic               | Decision                                                                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data location**   | Postgres on Supabase; schema created and evolved by Payload (Drizzle under `@payloadcms/db-postgres`). No Prisma.                                                                                                                                                                     |
| **Listings ↔ Tags** | Many-to-many: Listing has `tags` relationship (array of Tag); junction table managed by Payload.                                                                                                                                                                                      |
| **Tag knowledge**   | One `tags` collection: `description` (short), `content` (richText), `resources` (array of `{ label, url, type }`), optional `media` relation. Category select: style, exterior, roofing, structure, systems, utilities, interior, parking, features, hazards, era, region (12 total). |
| **Media**           | **PoC:** Payload local uploads (files on server filesystem). **Later:** Supabase Storage via S3-compatible API + `@payloadcms/storage-s3` to avoid server disk and to suit serverless (Fly/Railway). Recommend adding S3 when deploying or when storage grows.                        |
| **Auth (admin)**    | Payload built-in auth (email + password); cookies/session. Roles via Payload `roles` or custom field on User.                                                                                                                                                                         |
| **Access control**  | Payload `access` per collection: `read` public for Listings/Tags/Media; `create/update/delete` require `isAdmin` or role. HomeRecords/HomeRecordDocuments: owner-only via `where` constraint. Users: admin-only read (except self).                                                   |
| **HomeRecords**     | Private per-user. `owner` (User), optional `listing` (Listing). 1 listing : N records (multiple owners over time). Documents sub-collection with upload + metadata. Future: AI processing, record transfer.                                                                           |
| **Styling**         | **Panda CSS + Park UI** (replaced Tailwind). Config: `panda.config.ts` (Park UI preset, ruby accent, olive gray). Theme tokens/recipes in `src/theme/`. Component library: `src/components/ui/` (14 Park UI components). PostCSS plugin: `@pandacss/dev/postcss`.                     |
| **SEO**             | Basic: Next.js `metadata`/`generateMetadata` on listing and tag pages (title, description). Sitemap/structured data in Phase 3 or later.                                                                                                                                              |

**Server Actions vs dedicated API**

- **Server Actions:** No separate route; call async functions from forms or client. Good for mutations (submit form, create/update). Less discoverable (no GET URL); not callable by external clients or mobile. Caching is via Next.js (revalidatePath/revalidateTag). No custom response headers (e.g. Cache-Control) unless you return from a route that uses the action. Simpler for PoC: one place (server) for logic; shared types with Payload.
- **Dedicated API routes (e.g. `/api/listings`):** Explicit GET/POST; cacheable by URL and standard HTTP semantics; callable by other clients (mobile, external); easy to add Cache-Control, ETag. More code (route handler + possibly duplicate validation). Needed if you want public REST for third parties or if you need fine-grained HTTP caching.
- **Recommendation for PoC:** Use Payload's built-in REST API for all reads (and admin writes). Use Server Actions only for any custom mutations you add (e.g. "contact agent" form, ingestion trigger). Add dedicated API routes only if you need external consumers or explicit HTTP caching at the route level.

**Migrations (frequent early changes)**

- Payload + Drizzle: use **push** in dev (schema synced from config on dev server start); use **migrate** for production. For frequent schema iteration, rely on push; once shape stabilizes, run `payload migrate:create` and then `payload migrate` in prod. Keep migration files in version control; avoid mixing push in one env and migrate in another for the same branch.

---

## 3. Scaffolding steps and file/folder structure

### Package manager and init

- Use **pnpm**. Commands: `pnpm create next-app@latest . --ts --eslint --app --src-dir --no-turbopack` (or manual Next + Payload).
- Alternatively: `pnpm create payload-app@latest` and choose Next.js + Postgres, then add Supabase `DATABASE_URL`.
- Install: `@payloadcms/db-postgres`, `@payloadcms/next` (if using official Next integration), and Payload peer deps.

### Suggested folder structure

```text
src/
  app/
    layout.tsx             # root layout (nav, Panda CSS)
    globals.css            # Panda CSS layer directives
    page.tsx               # removed (replaced by (frontend)/page.tsx)
    CLAUDE.md              # app routing context
    (frontend)/            # public routes
      page.tsx             # / — landing
      listings/
        page.tsx           # /listings (paginated, ?tag filter)
        [slug]/page.tsx    # /listings/[slug] (full detail)
      tags/
        [slug]/page.tsx    # /tags/[slug] (knowledge hub)
    (payload)/             # Payload route handlers
      layout.tsx
      admin/[[...segments]]/page.tsx
      api/[...slug]/route.ts
  collections/             # Payload collection configs
    Users.ts
    Tags.ts
    Listings.ts
    Media.ts
    CLAUDE.md              # collection conventions
    HomeRecords.ts         # Phase 7
    HomeRecordDocuments.ts # Phase 7
  components/              # Park UI component library
    ui/
      index.ts             # barrel export
      badge.tsx
      button.tsx
      card.tsx
      heading.tsx
      icon.tsx
      link.tsx
      text.tsx
      spinner.tsx
      loader.tsx
      group.tsx
      span.tsx
      absolute-center.tsx
    CLAUDE.md              # component patterns
  theme/                   # Panda CSS theme system
    tokens/                # colors, shadows, durations, z-index
    recipes/               # component recipes (button, card, badge, etc.)
    conditions.ts
    keyframes.ts
    global-css.ts
    text-styles.ts
    layer-styles.ts
    animation-styles.ts
    colors/ruby.ts
    CLAUDE.md              # theme context
  lib/
    access.ts              # shared isAdmin access control
    validate.ts            # slug + safeUrl validators
    payload.ts             # getPayload() server helper (cached singleton)
    search.ts              # query builder: searchParams -> Payload where (Phase 3)
  payload.config.ts        # Payload config
  payload-types.ts         # generated; run `pnpm generate:types`
scripts/
  seed.ts                  # seed tags + listings; run `pnpm seed`
tests/
  unit/                    # Vitest unit tests
  integration/             # Payload integration tests (needs DB)
  e2e/                     # Playwright E2E tests
  CLAUDE.md                # testing patterns
panda.config.ts            # Panda CSS config (Park UI preset, ruby/olive)
postcss.config.mjs         # PostCSS with @pandacss/dev plugin
components.json            # Park UI CLI config
.env.example
.env.local                 # actual env (gitignored)
```

**Key conventions:**

- **Imports:** Use `@/` alias (maps to `src/`). E.g. `import { getPayload } from '@/lib/payload'`, `import { isAdmin } from '@/lib/access'`.
- **Access control:** All collections import `isAdmin` from `@/lib/access`.
- **Validators:** Slug and URL fields use `slug` / `safeUrl` from `@/lib/validate`.
- **Numerics:** All count/size/price fields have `min: 0`.
- **Env:** Required vars (`DATABASE_URL`, `PAYLOAD_SECRET`) validated at startup via `requireEnv()` in `payload.config.ts`.

### Config and env

- **Payload config:** `src/payload.config.ts` — imports collections from `./collections/`, uses `requireEnv()` for `DATABASE_URL` and `PAYLOAD_SECRET`, Lexical editor, 10MB upload limit. See Section 6 for full code.
- **.env template (no secrets):** See section 6 below. Actual env file is `.env.local` (gitignored).

### Collections to add (Phase 1)

- **Users** — Extend default or use Payload’s; add role field if needed.
- **Tags** — See code snippet below.
- **Listings** — `title`, `slug`, `address`, `city`, `state`, `region`, `yearBuilt`, `price`, location/property/interior/lot/financial groups, `listingEvents`, `garageSpaces`, `summary`, `sourceUrl`, `photos` (upload array), `tags` (relationship many).
- **Media** — Standard upload collection; enable in config.

### Seed script

- Script: `scripts/seed.ts` run with `tsx`: get Payload instance, create 2-3 tags (e.g. "Brick Exterior", "Knob-and-Tube Wiring", "Slate Roof") then 2-3 Grand Rapids listings with tag relations. Use `payload.create()`; no Prisma. Add `"seed": "tsx scripts/seed.ts"` to `package.json`.

### Public routes (Phase 2 — implemented)

- **UI:** Root layout has nav (Home, Listings). `(frontend)/` route group for public pages. Uses Panda CSS + Park UI components. Server Components fetch via `getPayload()` from `@/lib/payload`. Component library in `src/components/ui/`.

---

## 4. Tight typing (Payload + Zod)

- **Payload types:** Run `payload generate:types`; output e.g. `src/payload-types.ts`. Import `Listing`, `Tag`, `Media` (etc.) in both server and client components. No extra “DTO” layer for read-only public data unless you need runtime validation.
- **Sharing types:** Server components and Server Actions import from `@/payload-types` (or relative path). Client components receive only serializable props; types are the same interfaces. For API route responses, return Payload document types directly (or subset) so front-end stays typed.
- **Zod:** Use when you accept user input (e.g. server action for a future “contact” form or ingestion script). For public reads from Payload, Payload’s types are enough; optional Zod parse only if you consume external APIs or form bodies. Prefer Zod in: server actions, webhooks, ingestion scripts.

---

## 5. Task checklist (scaffolding)

- Init repo: pnpm, Next 15 (App Router), TypeScript.
- Add Payload 3 + `@payloadcms/db-postgres`; configure `payload.config.ts` and Postgres adapter.
- Add `.env.example` and document `DATABASE_URL`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL`.
- Create Payload collections: Users (default/extends), Tags, Listings, Media.
- Mount Payload admin at `/admin` and API at `/api`.
- Run `payload generate:types`; add `src/payload-types.ts` to repo (or CI step).
- Implement `getPayload()` helper in `src/lib/payload.ts` for server use.
- Seed script: 2-3 tags + 2-3 listings (realistic Michigan / Grand Rapids data); document `pnpm seed`.
- Public routes: `/`, `/listings`, `/listings/[slug]`, `/tags/[slug]` with Server Component fetches.
- Basic access control: public read for Listings/Tags/Media; admin write.
- Optional: simple filter `/listings?tag=slug` in Phase 2 or 3.
- Test harness: Vitest (unit/integration) + Playwright (E2E); add tests per phase.
- PostHog: add provider and env vars when implementing analytics (Phase 2 or 3).

---

## 6. .env template and code snippets

### .env.example (no secrets)

```env
# Database (Supabase Postgres connection string)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Payload
PAYLOAD_SECRET=your-min-32-char-secret-here
NEXT_PUBLIC_SERVER_URL=http://localhost:3000

# Optional (Phase 4+): Supabase S3 for media
# S3_ENDPOINT=https://[PROJECT-REF].supabase.co/storage/v1/s3
# S3_ACCESS_KEY_ID=
# S3_SECRET_ACCESS_KEY=
# S3_BUCKET=uploads
# S3_REGION=us-east-1

# Analytics (PostHog; Phase 2 or 3)
# NEXT_PUBLIC_POSTHOG_KEY=
# NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

### payload.config.ts (actual — reflects current code)

```ts
// src/payload.config.ts — ESM, uses dotenv for .env.local
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const requireEnv = (name: string): string => {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
};

import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { buildConfig } from "payload";
import sharp from "sharp";

import { Users } from "./collections/Users";
import { Media } from "./collections/Media";
import { Tags } from "./collections/Tags";
import { Listings } from "./collections/Listings";

const __filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(__filename);

export default buildConfig({
  admin: {
    meta: { titleSuffix: " | hohm.info" },
    importMap: {
      baseDir: path.resolve(dirname),
      importMapFile: path.resolve(dirname, "app/(payload)/admin/importMap.ts"),
    },
    user: Users.slug,
  },
  collections: [Users, Media, Tags, Listings],
  editor: lexicalEditor({}),
  db: postgresAdapter({
    pool: { connectionString: requireEnv("DATABASE_URL") },
  }),
  upload: {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
    },
  },
  sharp,
  secret: requireEnv("PAYLOAD_SECRET"),
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000",
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
});
```

---

### Example collection: Tags (actual — reflects current code)

```ts
// src/collections/Tags.ts
import type { CollectionConfig } from "payload";
import { isAdmin } from "@/lib/access";
import { slug, safeUrl } from "@/lib/validate";

export const Tags: CollectionConfig = {
  slug: "tags",
  admin: { useAsTitle: "name", defaultColumns: ["name", "slug", "category"] },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      validate: slug,
    },
    {
      name: "category",
      type: "select",
      options: [
        { label: "Style", value: "style" },
        { label: "Exterior", value: "exterior" },
        { label: "Roofing", value: "roofing" },
        { label: "Structure", value: "structure" },
        { label: "Systems", value: "systems" },
        { label: "Utilities", value: "utilities" },
        { label: "Interior", value: "interior" },
        { label: "Parking", value: "parking" },
        { label: "Features", value: "features" },
        { label: "Hazards", value: "hazards" },
        { label: "Era", value: "era" },
        { label: "Region", value: "region" },
      ],
    },
    { name: "description", type: "textarea" },
    { name: "content", type: "richText" },
    {
      name: "resources",
      type: "array",
      fields: [
        { name: "label", type: "text", required: true },
        { name: "url", type: "text", required: true, validate: safeUrl },
        {
          name: "type",
          type: "select",
          options: [
            { label: "Link", value: "link" },
            { label: "YouTube", value: "youtube" },
            { label: "Guide", value: "guide" },
            { label: "Cost", value: "cost" },
          ],
        },
      ],
    },
    { name: "media", type: "upload", relationTo: "media", hasMany: true },
  ],
};
```

---

### Listings query used by a page (Server Component)

```ts
// In app/(frontend)/listings/page.tsx or similar
import { getPayload } from '@/lib/payload'

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>
}) {
  const payload = await getPayload()
  const { tag: tagSlug } = await searchParams

  const { docs: listings, totalPages, page } = await payload.find({
    collection: 'listings',
    where: tagSlug
      ? { 'tags.slug': { equals: tagSlug } }
      : undefined,
    sort: '-createdAt',
    limit: 20,
    page: 1,
    depth: 1, // resolve tag refs to one level
  })

  return (
    <ul>
      {listings.map((listing) => (
        <li key={listing.id}>
          <a href={`/listings/${listing.slug}`}>{listing.title}</a>
        </li>
      ))}
    </ul>
  )
}
```

`getPayload()` is a server-only helper that returns the Payload instance (e.g. from `getPayloadHMR()` or a singleton built from your config). Use it only in server components or server actions.

---

## 7. Summary diagram

```mermaid
flowchart LR
  subgraph public [Public Site]
    Home[/]
    ListPage["/listings"]
    DetailPage["/listings/slug"]
    TagPage["/tags/slug"]
  end
  subgraph admin [Admin]
    Admin["/admin"]
  end
  subgraph payload [Payload API]
    API["/api"]
  end
  subgraph data [Postgres]
    Users[(Users)]
    Tags[(Tags)]
    Listings[(Listings)]
    Media[(Media)]
    HomeRecords[(HomeRecords)]
    HomeRecordDocs[(HomeRecordDocuments)]
  end
  Home --> API
  ListPage --> API
  DetailPage --> API
  TagPage --> API
  Admin --> API
  API --> Users
  API --> Tags
  API --> Listings
  API --> Media
  API --> HomeRecords
  API --> HomeRecordDocs
  Listings --> Tags
  HomeRecords --> Listings
  HomeRecords --> Users
  HomeRecordDocs --> HomeRecords
```

You can start coding from Phase 0 (bootstrap + Payload + Postgres), then Phase 1 (collections + admin), then Phase 2 (public pages and the listings query above). The same repo supports adding Phase 3–5 later without changing the core stack.
