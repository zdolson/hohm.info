/**
 * Seed tags and listings (Phase 1b). Run: pnpm seed
 * Requires DATABASE_URL and PAYLOAD_SECRET in .env.local
 *
 * Tags: ~20 across 12 categories with description + resources.
 * Listings: 3 real-data (Anderson EGR, Owosso Victorian, Seattle off-market).
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { getPayload } from "payload";
import config from "../src/payload.config";

type TagCategory =
  | "style"
  | "exterior"
  | "roofing"
  | "structure"
  | "systems"
  | "utilities"
  | "interior"
  | "parking"
  | "features"
  | "hazards"
  | "era"
  | "region";

type ResourceType = "link" | "youtube" | "guide" | "cost";

const tagData: Array<{
  name: string;
  slug: string;
  category: TagCategory;
  description: string;
  resources: Array<{ label: string; url: string; type: ResourceType }>;
}> = [
  { name: "Ranch", slug: "ranch", category: "style", description: "Single-story, low-pitch roof, open layout.", resources: [{ label: "Ranch style guide", url: "https://www.nps.gov/subjects/nationalregister/ranch-style.htm", type: "guide" }] },
  { name: "Victorian", slug: "victorian", category: "style", description: "Ornate details, steep roofs, varied forms.", resources: [{ label: "Victorian architecture", url: "https://en.wikipedia.org/wiki/Victorian_architecture", type: "link" }] },
  { name: "Brick Exterior", slug: "brick-exterior", category: "exterior", description: "Brick cladding; consider tuckpointing and thermal mass.", resources: [{ label: "Brick maintenance", url: "https://example.com/brick-maintenance", type: "guide" }] },
  { name: "Wood Exterior", slug: "wood-exterior", category: "exterior", description: "Wood siding; paint maintenance, rot and insect risk.", resources: [{ label: "Wood siding care", url: "https://example.com/wood-siding", type: "guide" }] },
  { name: "Asphalt Shingle", slug: "asphalt-shingle", category: "roofing", description: "Common roofing; typical lifespan 15–25 years.", resources: [{ label: "Roof lifespan", url: "https://example.com/roof-life", type: "link" }] },
  { name: "Full Basement", slug: "full-basement", category: "structure", description: "Full below-grade space; moisture and radon considerations.", resources: [{ label: "Basement moisture", url: "https://example.com/basement-moisture", type: "guide" }] },
  { name: "Forced Air Heating", slug: "forced-air-heating", category: "systems", description: "Central furnace and ductwork.", resources: [{ label: "HVAC basics", url: "https://example.com/hvac", type: "link" }] },
  { name: "Natural Gas", slug: "natural-gas", category: "utilities", description: "Gas service for heat, cooking, etc.", resources: [{ label: "Gas safety", url: "https://example.com/gas-safety", type: "guide" }] },
  { name: "Public Water", slug: "public-water", category: "utilities", description: "Municipal water supply.", resources: [{ label: "Water quality", url: "https://example.com/water", type: "link" }] },
  { name: "Public Sewer", slug: "public-sewer", category: "utilities", description: "Municipal sewer connection.", resources: [{ label: "Sewer line info", url: "https://example.com/sewer", type: "link" }] },
  { name: "Hardwood Floors", slug: "hardwood-floors", category: "interior", description: "Solid or engineered hardwood flooring.", resources: [{ label: "Hardwood care", url: "https://example.com/hardwood", type: "guide" }] },
  { name: "Tile Flooring", slug: "tile-flooring", category: "interior", description: "Ceramic or stone tile.", resources: [{ label: "Tile maintenance", url: "https://example.com/tile", type: "link" }] },
  { name: "Replacement Windows", slug: "replacement-windows", category: "interior", description: "Updated windows; improved efficiency.", resources: [{ label: "Window efficiency", url: "https://example.com/windows", type: "link" }] },
  { name: "Main Level Primary", slug: "main-level-primary", category: "interior", description: "Primary bedroom on main floor.", resources: [{ label: "Single-level living", url: "https://example.com/main-level", type: "link" }] },
  { name: "Basement Laundry", slug: "basement-laundry", category: "interior", description: "Laundry in basement.", resources: [{ label: "Laundry placement", url: "https://example.com/laundry", type: "link" }] },
  { name: "Side-Facing Garage", slug: "side-facing-garage", category: "parking", description: "Garage set to side of lot.", resources: [{ label: "Garage types", url: "https://example.com/garage", type: "link" }] },
  { name: "Attached Garage", slug: "attached-garage", category: "parking", description: "Garage attached to dwelling.", resources: [{ label: "Attached garage", url: "https://example.com/attached-garage", type: "link" }] },
  { name: "Fireplace", slug: "fireplace", category: "features", description: "Wood or gas fireplace.", resources: [{ label: "Fireplace safety", url: "https://example.com/fireplace", type: "guide" }] },
  { name: "Fenced Yard", slug: "fenced-yard", category: "features", description: "Fenced outdoor space.", resources: [{ label: "Fence materials", url: "https://example.com/fence", type: "link" }] },
  { name: "Knob-and-Tube Wiring", slug: "knob-and-tube-wiring", category: "hazards", description: "Older electrical system; may need upgrade for capacity and insurance.", resources: [{ label: "K&T wiring", url: "https://example.com/knob-and-tube", type: "guide" }] },
  { name: "Victorian Era", slug: "victorian-era", category: "era", description: "Built in Victorian period (mid–late 1800s).", resources: [{ label: "Victorian era", url: "https://example.com/victorian-era", type: "link" }] },
  { name: "Post-War", slug: "post-war", category: "era", description: "Built in post-WWII period (late 1940s–1960s).", resources: [{ label: "Post-war housing", url: "https://example.com/post-war", type: "link" }] },
];

const owossoListingEvents = [
  { date: "2020-05-05", eventType: "listed" as const, price: 187000, source: "Agent Provided" },
  { date: "2020-06-08", eventType: "priceChange" as const, price: 179000 },
  { date: "2020-06-09", eventType: "pending" as const, price: 179000 },
  { date: "2020-06-23", eventType: "active" as const, price: 179000 },
  { date: "2020-06-26", eventType: "pending" as const, price: 179000 },
  { date: "2020-07-31", eventType: "active" as const, price: 179000 },
  { date: "2021-02-02", eventType: "listingRemoved" as const },
  { date: "2021-04-19", eventType: "listed" as const, price: 179000, source: "MiRealSource", mlsNumber: "50039282" },
  { date: "2021-04-22", eventType: "pending" as const, price: 179000 },
  { date: "2021-05-14", eventType: "sold" as const, price: 210000 },
];

async function seed() {
  const payload = await getPayload({ config });

  try {
    const tagIds: Record<string, number> = {};
    for (const t of tagData) {
      const existing = await payload.find({
        collection: "tags",
        where: { slug: { equals: t.slug } },
        limit: 1,
      });
      if (existing.docs.length > 0) {
        tagIds[t.slug] = existing.docs[0].id as number;
        console.log("Tag exists:", t.slug);
      } else {
        const doc = await payload.create({
          collection: "tags",
          data: {
            name: t.name,
            slug: t.slug,
            category: t.category,
            description: t.description,
            resources: t.resources,
          },
          overrideAccess: true,
        });
        tagIds[t.slug] = doc.id as number;
        console.log("Created tag:", t.slug);
      }
    }

    const listings: Array<{
      title: string;
      slug: string;
      address: string;
      city: string;
      state: string;
      region?: string;
      location?: { zipCode?: string; county?: string };
      property?: { propertyType?: "singleFamily" | "condo" | "townhouse" | "multiFamily" | "land" | "mobileHome"; status?: "active" | "pending" | "sold" | "offMarket"; stories?: number };
      interior?: { bedrooms?: number; bathroomsFull?: number; bathroomsHalf?: number; squareFootage?: number; fireplaces?: number };
      lot?: { lotSize?: number };
      financial?: { annualTaxes?: number; taxYear?: number };
      yearBuilt: number;
      price: number;
      garageSpaces?: number;
      summary: string;
      sourceUrl?: string;
      listingEvents: Array<{ date: string; eventType: "listed" | "priceChange" | "pending" | "active" | "sold" | "listedForRent" | "listingRemoved"; price?: number; source?: string; mlsNumber?: string }>;
      tags: number[];
    }> = [
      {
        title: "2115 Anderson Dr SE",
        slug: "2115-anderson-dr-se-east-grand-rapids",
        address: "2115 Anderson Dr SE",
        city: "East Grand Rapids",
        state: "MI",
        region: "West Michigan",
        location: { zipCode: "49506", county: "Kent" },
        property: { propertyType: "singleFamily", status: "sold", stories: 1 },
        interior: { bedrooms: 3, bathroomsFull: 1, bathroomsHalf: 2, squareFootage: 1722, fireplaces: 1 },
        yearBuilt: 1950,
        price: 525000,
        garageSpaces: 1,
        summary: "1950 brick ranch in East Grand Rapids. Main-level primary, basement laundry, side-facing garage.",
        listingEvents: [
          { date: "2024-11-26", eventType: "sold", price: 525000, source: "MLS", mlsNumber: "24055348" },
        ],
        tags: [tagIds["ranch"], tagIds["brick-exterior"], tagIds["full-basement"], tagIds["forced-air-heating"], tagIds["natural-gas"], tagIds["public-water"], tagIds["public-sewer"], tagIds["replacement-windows"], tagIds["main-level-primary"], tagIds["basement-laundry"], tagIds["side-facing-garage"], tagIds["fireplace"], tagIds["fenced-yard"], tagIds["post-war"]].filter(Boolean),
      },
      {
        title: "408 W King St",
        slug: "408-w-king-st-owosso",
        address: "408 W King St",
        city: "Owosso",
        state: "MI",
        location: { zipCode: "48867", county: "Shiawassee" },
        property: { propertyType: "singleFamily", status: "sold", stories: 2 },
        interior: { bedrooms: 6, bathroomsFull: 4, bathroomsHalf: 1, squareFootage: 4329, fireplaces: 1 },
        yearBuilt: 1889,
        price: 210000,
        garageSpaces: 0,
        summary: "1889 wood Victorian in Owosso. Full basement, extensive price and status history.",
        listingEvents: owossoListingEvents,
        tags: [tagIds["victorian"], tagIds["wood-exterior"], tagIds["full-basement"], tagIds["forced-air-heating"], tagIds["natural-gas"], tagIds["public-water"], tagIds["public-sewer"], tagIds["hardwood-floors"], tagIds["fireplace"], tagIds["knob-and-tube-wiring"], tagIds["victorian-era"]].filter(Boolean),
      },
      {
        title: "8528 32nd Ave NW",
        slug: "8528-32nd-ave-nw-seattle",
        address: "8528 32nd Ave NW",
        city: "Seattle",
        state: "WA",
        region: "North Beach-Blue Ridge",
        location: { zipCode: "98117", county: "King" },
        property: { propertyType: "singleFamily", status: "offMarket", stories: 1 },
        interior: { bedrooms: 3, bathroomsFull: 2, bathroomsHalf: 0, squareFootage: 1850, fireplaces: 1 },
        yearBuilt: 1948,
        price: 1020000,
        garageSpaces: 1,
        summary: "1948 single-family in Seattle. Off-market with rental history. Hardwood and tile, attached garage.",
        listingEvents: [
          { date: "2023-01-15", eventType: "listedForRent", price: 3500, source: "Zillow" },
          { date: "2024-06-01", eventType: "listingRemoved" },
        ],
        tags: [tagIds["ranch"], tagIds["full-basement"], tagIds["forced-air-heating"], tagIds["public-water"], tagIds["public-sewer"], tagIds["hardwood-floors"], tagIds["tile-flooring"], tagIds["attached-garage"], tagIds["fireplace"], tagIds["post-war"]].filter(Boolean),
      },
    ];

    for (const l of listings) {
      const existing = await payload.find({
        collection: "listings",
        where: { slug: { equals: l.slug } },
        limit: 1,
      });
      if (existing.docs.length > 0) {
        console.log("Listing exists:", l.slug);
      } else {
        await payload.create({
          collection: "listings",
          data: l,
          overrideAccess: true,
        });
        console.log("Created listing:", l.slug);
      }
    }

    console.log("Seed done.");
  } finally {
    if (typeof payload.db.destroy === "function") await payload.db.destroy();
  }
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
