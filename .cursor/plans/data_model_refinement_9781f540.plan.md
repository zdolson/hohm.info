---
name: Data Model Refinement
overview: Refine Listings, Tags, and Media collections based on real MLS data from 3 reference properties. Rename fields, add listingEvents array for price/status history, expand tag categories to 12, enrich Media, and rewrite seed with real + varied data.
todos:
  - id: 1b-listings
    content: "Refactor Listings.ts: rename beds/baths/sqft, add zipCode, county, propertyType, stories, bathroomsHalf, lotSize, fireplaces, annualTaxes, taxYear. Replace flat listDate/soldDate/mlsNumber with listingEvents array. Keep price + status as denormalized top-level for filtering. Use Payload field groups."
    status: completed
  - id: 1b-tags
    content: Expand Tags.ts category select from 5 to 12 options (style, exterior, roofing, structure, systems, utilities, interior, parking, features, hazards, era, region).
    status: completed
  - id: 1b-media
    content: Add alt and caption text fields to Media.ts.
    status: completed
  - id: 1b-seed
    content: "Rewrite seed.ts: ~20 tags (with descriptions + resources) across all 12 categories. 3 real-data listings (Anderson/Owosso/Seattle) with listingEvents history + varied tag combos."
    status: completed
  - id: 1b-types
    content: Re-run pnpm generate:types and verify.
    status: completed
  - id: 1b-plan-update
    content: Update existing plan phases 2-3 to reference new field names (bedrooms, bathroomsFull, squareFootage, listingEvents, etc.).
    status: completed
isProject: false
---

# Phase 1b: Data Model Refinement

Driven by analysis of **3 reference properties** spanning different eras, regions, and price points:

- **2115 Anderson Dr SE, East Grand Rapids, MI 49506** — 1950 brick ranch, sold $525K, 3bed/1full+2half, 1,722sqft, MLS #24055348
- **408 W King St, Owosso, MI 48867** — 1889 wood Victorian, sold $210K, 6bed/4full+1half, 4,329sqft, MLS #50039282
- **8528 32nd Ave NW, Seattle, WA 98117** — 1948 single-family, est $1.02M, 3bed/2bath, 1,850sqft, off-market with rental history

---

## Design Principle

- **Listing fields** = quantitative, filterable, structured data (counts, prices, dates, dimensions)
- **Tags** = qualitative attributes that carry **knowledge content** (materials, systems, styles, hazards)
- **Listing events** = temporal data (price changes, listings, sales, rentals) — array, not flat fields

Every tag is an educational opportunity: "Brick Exterior" links to tuckpointing guides, thermal mass info. "Full Basement" links to moisture mitigation, radon testing. "Wood Exterior" links to paint maintenance, rot prevention, insect risk.

---

## 1. Listings Collection Changes

File: [src/collections/Listings.ts](src/collections/Listings.ts)

### Renames

- `beds` --> `bedrooms`
- `baths` --> `bathroomsFull`
- `sqft` --> `squareFootage`

### New fields (split into Payload field groups for admin UX)

**Location group** (existing + new):

- `zipCode` (text)
- `county` (text)
- `region` stays (optional freeform, e.g. "West Michigan")

**Property group** (new):

- `propertyType` (select: `singleFamily`, `condo`, `townhouse`, `multiFamily`, `land`, `mobileHome`)
- `status` (select: `active`, `pending`, `sold`, `offMarket`) — denormalized from latest event for filtering
- `stories` (number)

**Interior group** (renamed + new):

- `bedrooms` (number) -- was `beds`
- `bathroomsFull` (number) -- was `baths`
- `bathroomsHalf` (number) -- NEW
- `squareFootage` (number) -- was `sqft`
- `fireplaces` (number, default 0) -- NEW

**Lot group** (new):

- `lotSize` (number — acres)

**Financial group** (new):

- `annualTaxes` (number)
- `taxYear` (number)

### Listing Events (replaces flat listDate/soldDate/mlsNumber)

**Why:** The 408 W King St property demonstrates a property can be listed, repriced, go pending, return to active, be delisted, relisted months later, and finally sell — all with different prices. The 8528 32nd Ave NW property shows rental listings interleaved. Flat `listDate`/`soldDate` fields cannot represent this.

**Solution:** `listingEvents` array field + keep `price` and `status` as denormalized top-level fields for search/filter.

```ts
{
  name: "listingEvents",
  type: "array",
  admin: { components: { RowLabel: "..." } },
  fields: [
    { name: "date", type: "date", required: true },
    {
      name: "eventType",
      type: "select",
      required: true,
      options: [
        { label: "Listed for Sale", value: "listed" },
        { label: "Price Change", value: "priceChange" },
        { label: "Pending", value: "pending" },
        { label: "Back on Market", value: "active" },
        { label: "Sold", value: "sold" },
        { label: "Listed for Rent", value: "listedForRent" },
        { label: "Listing Removed", value: "listingRemoved" },
      ],
    },
    { name: "price", type: "number" },
    { name: "source", type: "text" },
    { name: "mlsNumber", type: "text" },
  ],
}
```

**Top-level `price`** = most recent sale price, or current asking price. Stays for filtering.
**Top-level `status`** = current status. Stays for filtering.
`**mlsNumber**` moves INTO events (a property can have different MLS #s across listings).

### Reference: 408 W King St listing events

```ts
listingEvents: [
  {
    date: "2020-05-05",
    eventType: "listed",
    price: 187000,
    source: "Agent Provided",
  },
  { date: "2020-06-08", eventType: "priceChange", price: 179000 },
  { date: "2020-06-09", eventType: "pending", price: 179000 },
  { date: "2020-06-23", eventType: "active", price: 179000 },
  { date: "2020-06-26", eventType: "pending", price: 179000 },
  { date: "2020-07-31", eventType: "active", price: 179000 },
  { date: "2021-02-02", eventType: "listingRemoved" },
  {
    date: "2021-04-19",
    eventType: "listed",
    price: 179000,
    source: "MiRealSource",
    mlsNumber: "50039282",
  },
  { date: "2021-04-22", eventType: "pending", price: 179000 },
  { date: "2021-05-14", eventType: "sold", price: 210000 },
];
```

### Kept as-is

`title`, `slug`, `address`, `city`, `state`, `yearBuilt`, `price`, `garageSpaces`, `summary`, `sourceUrl`, `photos`, `tags`

---

## 2. Tags Collection Changes

File: [src/collections/Tags.ts](src/collections/Tags.ts)

**Expand category select from 5 to 12.** Cross-referenced against all 3 properties:

- `style` — Architectural styles: **Ranch** (Anderson), **Victorian** (Owosso), inferred from Seattle
- `exterior` — Cladding/siding: **Brick** (Anderson), **Wood** (Owosso)
- `roofing` — Roof materials/types: Asphalt Shingle, Slate, Metal, Cedar Shake
- `structure` — Foundation/basement: **Full Basement** (Anderson, Owosso, Seattle)
- `systems` — HVAC, electrical, plumbing: **Forced Air Heating** (all 3)
- `utilities` — Service connections: **Natural Gas** (Anderson, Owosso), **Public Water**, **Public Sewer**
- `interior` — Flooring, windows, layout: **Hardwood Floors** + **Tile Flooring** (Seattle), **Replacement Windows** (Anderson), **Main Level Primary** (Anderson), **Basement Laundry** (Anderson)
- `parking` — Vehicle storage: **Side-Facing Garage** (Anderson), **Attached Garage** + **Off-Street Parking** (Seattle)
- `features` — Amenities: **Fenced Yard** (Anderson), **Fireplace** (all 3), **Pool** (Seattle)
- `hazards` — Safety/environmental: Lead Paint risk (pre-1978: all 3), Knob-and-Tube Wiring (possible in 1889 Owosso)
- `era` — Time period: **Victorian Era** (Owosso 1889), **Post-War** (Anderson 1950, Seattle 1948)
- `region` — Geographic: East Grand Rapids, Owosso, North Beach-Blue Ridge (Seattle)

**No structural changes to tag fields** — `name`, `slug`, `category`, `description`, `content`, `resources`, `media` are correct. Just expanding the category options.

---

## 3. Media Collection Changes

File: [src/collections/Media.ts](src/collections/Media.ts)

Add metadata fields:

- `alt` (text) — accessibility/SEO alt text
- `caption` (text) — descriptive caption

---

## 4. Seed Script Rewrite

File: [scripts/seed.ts](scripts/seed.ts)

### Tags (~20)

Each with real `description` and at least 1 `resource`. Covering all 12 categories:

**style:** Ranch, Victorian
**exterior:** Brick Exterior, Wood Exterior
**roofing:** Asphalt Shingle
**structure:** Full Basement
**systems:** Forced Air Heating
**utilities:** Natural Gas, Public Water, Public Sewer
**interior:** Hardwood Floors, Tile Flooring, Replacement Windows, Main Level Primary Bedroom, Basement Laundry
**parking:** Side-Facing Garage, Attached Garage
**features:** Fireplace, Fenced Yard, Pool
**hazards:** Knob-and-Tube Wiring (carry-over from Phase 1, now with richer content)
**era:** Victorian Era, Post-War
**region:** (optional, lower priority for seed)

### Listings (3 — all from real data)

1. **2115 Anderson Dr SE, East Grand Rapids, MI** — 1950 ranch, $525K sold, 1 event (sold 11/26/2024)
2. **408 W King St, Owosso, MI** — 1889 Victorian, $210K sold, 10 events (full price history cycle)
3. **8528 32nd Ave NW, Seattle, WA** — 1948, $1.02M est, off-market, rental events history

This provides variety in:

- Era (1889 vs 1948 vs 1950)
- Region (small-town MI vs suburban MI vs Seattle)
- Price point ($210K vs $525K vs $1M+)
- Size (1,722 vs 1,850 vs 4,329 sqft)
- Event history depth (1 event vs 10 events vs rental events)

---

## 5. Ingestion Pipeline Resources (for Phase 4)

Data sources investigated and documented for future ingestion work:

### Primary: Zillow

- **URL format:** `https://www.zillow.com/homedetails/{address}/{zpid}_zpid/`
- **ZPID:** unique property ID (e.g. `23851902` for Anderson, `122608427` for Owosso, `48789557` for Seattle)
- **Limitation:** heavily client-rendered; direct fetch returns minimal data
- **Available fields** (via Zillow Exporter / third-party scrapers): ZPID, Status, Type, Address (full/street/city/state/zip), Price, Bedrooms, Bathrooms, Footage, LotArea, TaxAssessedValue, YearBuilt, Stories, Heating, Cooling, HasFireplaces, Flooring, Foundation, GarageCapacity, Sewer, RoofType, PropertyCondition, Description, MLSId, MLSSource, VirtualTourURL, ParcelId, HOAFee, DaysOnZillow, LastPriceChangeDate, LastDateSold
- **Third-party APIs:**
  - TypedAPI Zillow History API — price history by URL, free credits available
  - Apify Zillow Price History Scraper — by ZPID/URL/address, $9.99/1K results
  - Zillow Exporter — bulk export tool with all fields above

### Secondary: Trulia (Zillow-owned)

- **URL format:** `https://www.trulia.com/home/{address-slug}-{trulia-id}`
- **Advantage:** more scrapable HTML than Zillow; includes full price history table, interior/exterior features, tax history
- **Fields observed:** beds, baths (full/half breakdown), sqft, lot acres, year built, stories, heating type, heating fuel, fireplace, exterior material, rooms, parking, pool, HOA, full price history with event types (Listed, PriceChange, Pending, PendingToActive, Sold, ListedForRent, ListingRemoved), tax assessment history
- **Price history event types observed:** Listed For Sale, PriceChange, Pending, PendingToActive, Sold, ListingRemoved, Listed For Rent

### Tertiary: MLS-sourced broker sites

- **@properties/Christie's** — clean HTML, includes: architectural style, exterior type, basement, heating system, fireplace, pool, parking type/spaces, lot size, tax amount/year, school district, MLS #
- **Coldwell Banker** — structured data: bedrooms, bathrooms (full/half), living area sqft, architectural style, building area, year built, lot sqft
- **Xsell Realty** — most detailed: all of the above plus county, stories, sewer, water, structure type, new construction flag, lot dimensions, fireplace count, laundry location, school district/high school, acceptable financing types, tax ID/parcel ID
- **Limitation:** each broker site has different HTML structure; scraping requires per-site adapters

### Quaternary: County records

- Tax assessment data, parcel IDs, sale records
- Available through county assessor websites (varies by jurisdiction)

### Recommended ingestion approach for Phase 4

1. **Zillow ZPID scraper** (via Apify or similar) for initial bulk data + all available fields
2. **Trulia scraper** for price history events (more reliable HTML)
3. **County records** for tax/assessment verification
4. **CSV import** as fallback for manual data entry

---

## 6. Plan-wide Updates

- **Phase 2** references: `beds/baths` in listing cards --> `bedrooms`/`bathroomsFull`+`bathroomsHalf`; listing detail should render `listingEvents` timeline
- **Phase 3** search builder: update param names (`bedrooms`, `bathroomsFull`, `squareFootage`, `propertyType`, `status`, etc.)
- **Phase 4** ingestion: reference the resources documented in section 5 above; CSV import should map to new field names + events array
- **Admin defaultColumns** in Listings.ts: update to use new field names
- Re-run `pnpm generate:types` after all collection changes

---

## Phase Ordering

```
Phase 0  (done) — Repo bootstrap
Phase 1  (done) — Initial data model + admin
Phase 1b (NEW)  — Data model refinement (this)
Phase 2         — Public site
Phase 3         — Search + filtering
Phase 4         — Ingestion (uses resources from section 5)
...etc
```

Phase 1b is a prerequisite for Phase 2 since the public site should render the refined field names, richer tag data, and listing events timeline.
