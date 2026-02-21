# src/collections
Payload collection configs. Source of truth for schema (Drizzle push local; migrations staging/prod).

## Conventions
- **Access:** Public `read` for Tags, Listings, Media. Users: admin or self (list = admin-only). `create`/`update`/`delete` → admin only. Import `isAdmin` from `@/lib/access`.
- **Slug:** `slug` field required + unique; validated via `slug` from `@/lib/validate` (lowercase alphanumeric + hyphens).
- **URLs:** Any user-facing URL field uses `safeUrl` validator from `@/lib/validate` (requires `https?://`).
- **Numerics:** All count/size/price fields have `min: 0`.
- **Relations:** Listings → media (upload), tags (relation). Tags → media optional.

## Files
- `Users.ts` — auth, role (admin/editor), access by role/self
- `Media.ts` — uploads (images, PDF); alt, caption. File size capped at 10MB via payload.config `upload.limits`.
- `Tags.ts` — name, slug, category (12: style|exterior|roofing|structure|systems|utilities|interior|parking|features|hazards|era|region), description, richText content, resources array (URL-validated)
- `Listings.ts` — title, slug, address, city, state, region, yearBuilt, price, garageSpaces; groups: location (zipCode, county), property (propertyType, status, stories), interior (bedrooms, bathroomsFull, bathroomsHalf, squareFootage, fireplaces), lot (lotSize), financial (annualTaxes, taxYear); listingEvents array; photos → media, tags → tags

## Shared helpers (@/lib)
- `@/lib/access` — `isAdmin` access control (used by all collections)
- `@/lib/validate` — `slug` (lowercase alphanum + hyphens), `safeUrl` (https?://) validators

## Gotchas
- Add new collection to `payload.config.ts` and run `pnpm generate:types`. Don't edit payload-types by hand.
- File size limit is global in `payload.config.ts` (`upload.limits.fileSize`), not per-collection.
