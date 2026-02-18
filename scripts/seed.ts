/**
 * Seed tags and listings. Run: pnpm seed
 * Requires DATABASE_URL and PAYLOAD_SECRET in .env.local
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { getPayload } from "payload";
import config from "../src/payload.config";

async function seed() {
  const payload = await getPayload({ config });

  const tagData = [
    { name: "Brick Exterior", slug: "brick-exterior", category: "materials" as const, description: "Homes with brick exterior cladding." },
    { name: "Knob-and-Tube Wiring", slug: "knob-and-tube-wiring", category: "systems" as const, description: "Older electrical system; may need upgrade." },
    { name: "Slate Roof", slug: "slate-roof", category: "materials" as const, description: "Durable natural stone roofing." },
  ];

  const tagIds: number[] = [];
  for (const t of tagData) {
    const existing = await payload.find({
      collection: "tags",
      where: { slug: { equals: t.slug } },
      limit: 1,
    });
    if (existing.docs.length > 0) {
      tagIds.push(existing.docs[0].id as number);
      console.log("Tag exists:", t.slug);
    } else {
      const doc = await payload.create({
        collection: "tags",
        data: t,
        overrideAccess: true,
      });
      tagIds.push(doc.id as number);
      console.log("Created tag:", t.slug);
    }
  }

  const listings = [
    { title: "Grand Rapids Victorian", slug: "grand-rapids-victorian", city: "Grand Rapids", state: "MI", address: "123 Heritage Ave", beds: 4, baths: 2, sqft: 2400, garageSpaces: 1, yearBuilt: 1895, summary: "Charming Victorian with original details.", tags: [tagIds[0], tagIds[1]] },
    { title: "Eastown Bungalow", slug: "eastown-bungalow", city: "Grand Rapids", state: "MI", address: "456 Wealthy St", beds: 3, baths: 1, sqft: 1200, garageSpaces: 0, yearBuilt: 1920, summary: "Cozy bungalow near downtown.", tags: [tagIds[1], tagIds[2]] },
    { title: "Heritage Hill Colonial", slug: "heritage-hill-colonial", city: "Grand Rapids", state: "MI", address: "789 College Ave", beds: 5, baths: 3, sqft: 3200, garageSpaces: 2, yearBuilt: 1910, summary: "Stately colonial with slate roof.", tags: [tagIds[0], tagIds[2]] },
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
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
