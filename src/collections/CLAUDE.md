# src/collections
Payload collection configs. Source of truth for schema (Drizzle push local; migrations staging/prod).

## Conventions
- **Access:** Public `read` for Tags, Listings, Media; Users: read self or admin. `create`/`update`/`delete` → admin only. Reuse `isAdmin` helper.
- **Slug:** `slug` field required + unique where used (listings, tags).
- **Relations:** Listings → media (upload), tags (relation). Tags → media optional.

## Files
- `Users.ts` — auth, role (admin/editor), access by role/self
- `Media.ts` — uploads (images, PDF); alt, caption
- `Tags.ts` — name, slug, category (12: style|exterior|roofing|structure|systems|utilities|interior|parking|features|hazards|era|region), description, richText content, resources array
- `Listings.ts` — title, slug, address, city, state, region, yearBuilt, price, garageSpaces; groups: location (zipCode, county), property (propertyType, status, stories), interior (bedrooms, bathroomsFull, bathroomsHalf, squareFootage, fireplaces), lot (lotSize), financial (annualTaxes, taxYear); listingEvents array; photos → media, tags → tags

## Gotchas
- Add new collection to `payload.config.ts` and run `pnpm generate:types`. Don't edit payload-types by hand long-term.
