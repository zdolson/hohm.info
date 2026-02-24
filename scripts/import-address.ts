/**
 * Import listings by address via Zillow (Apify) + Trulia HTML scraping.
 * Run: pnpm import-address --address "Street, City, ST" [--address ...] [--file addresses.txt] [--dry-run] [--skip-trulia]
 */
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
void __dirname;

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { getPayload } from "payload";
import config from "../src/payload.config";
import { fetchZillow } from "./lib/fetchers/zillow";
import { fetchTruliaHistory } from "./lib/fetchers/trulia";
import { inferTagSlugs } from "./lib/infer-tags";
import { normalizeToListing } from "./lib/normalize";
import type { ScrapedEvent } from "./lib/fetcher";

function parseArgs() {
  const args = process.argv.slice(2);
  const addresses: string[] = [];
  const result = {
    addresses,
    file: undefined as string | undefined,
    dryRun: false,
    skipTrulia: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--address") result.addresses.push(args[++i]);
    else if (args[i] === "--file") result.file = args[++i];
    else if (args[i] === "--dry-run") result.dryRun = true;
    else if (args[i] === "--skip-trulia") result.skipTrulia = true;
  }
  return result;
}

function mergeEvents(a: ScrapedEvent[], b: ScrapedEvent[]): ScrapedEvent[] {
  const seen = new Set(a.map((e) => `${e.date}:${e.eventType}`));
  const merged = [...a];
  for (const e of b) {
    const key = `${e.date}:${e.eventType}`;
    if (!seen.has(key)) {
      merged.push(e);
      seen.add(key);
    }
  }
  return merged.sort((x, y) => x.date.localeCompare(y.date));
}

async function processAddress(
  address: string,
  payload: Awaited<ReturnType<typeof getPayload>>,
  opts: { dryRun: boolean; skipTrulia: boolean }
): Promise<boolean> {
  console.log(`\n[ADDRESS] ${address}`);

  // 1. Zillow
  let scraped;
  try {
    scraped = await fetchZillow(address);
    console.log(
      `[FETCHED] Zillow: ${scraped.address}, ${scraped.city}, ${scraped.state}`
    );
  } catch (err) {
    console.log(`[ERROR]   Zillow fetch failed: ${(err as Error).message}`);
    return false;
  }

  // 2. Trulia price history
  if (!opts.skipTrulia) {
    try {
      const truliaEvents = await fetchTruliaHistory(address);
      console.log(`[FETCHED] Trulia: ${truliaEvents.length} event(s)`);
      scraped.listingEvents = mergeEvents(scraped.listingEvents, truliaEvents);
    } catch (err) {
      console.log(
        `[WARN]    Trulia fetch failed (continuing): ${(err as Error).message}`
      );
    }
  }

  // 3. Infer tags from raw attributes
  const tagSlugs = inferTagSlugs(scraped.rawAttributes);
  console.log(
    `[INFER]   Tags: ${tagSlugs.length > 0 ? tagSlugs.join(", ") : "(none)"}`
  );

  // 4. Resolve or create tags
  const tagIds: number[] = [];
  for (const slug of tagSlugs) {
    const existing = await payload.find({
      collection: "tags",
      where: { slug: { equals: slug } },
      limit: 1,
    });

    if (existing.docs.length > 0) {
      tagIds.push(existing.docs[0].id as number);
    } else if (!opts.dryRun) {
      const name = slug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      try {
        const doc = await payload.create({
          collection: "tags",
          data: { name, slug, category: "features" },
          overrideAccess: true,
        });
        tagIds.push(doc.id as number);
        console.log(`[CREATED TAG] ${slug} (fallback category: features)`);
      } catch (err) {
        console.log(
          `[WARN]    Could not create tag "${slug}": ${(err as Error).message}`
        );
      }
    }
  }

  // 5. Normalize to Payload shape
  const listingData = normalizeToListing(scraped, tagIds);

  // 6. Skip if exists
  const existing = await payload.find({
    collection: "listings",
    where: { slug: { equals: listingData.slug } },
    limit: 1,
  });

  if (existing.docs.length > 0) {
    console.log(`[SKIP]    Listing already exists: ${listingData.slug}`);
    return true;
  }

  if (opts.dryRun) {
    console.log(`[DRY-RUN] Would create listing: ${listingData.slug}`);
    return true;
  }

  // 7. Create listing
  try {
    await payload.create({
      collection: "listings",
      data: listingData,
      overrideAccess: true,
    });
    console.log(`[CREATED] Listing: ${listingData.slug}`);
  } catch (err) {
    console.log(`[ERROR]   Create listing failed: ${(err as Error).message}`);
    return false;
  }

  return true;
}

async function main() {
  const args = parseArgs();

  const addresses = [...args.addresses];
  if (args.file) {
    const lines = readFileSync(args.file, "utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    addresses.push(...lines);
  }

  if (addresses.length === 0) {
    console.error(
      "No addresses provided. Use --address 'Street, City, ST' or --file addresses.txt"
    );
    process.exit(1);
  }

  const payload = await getPayload({ config });
  let hadError = false;

  try {
    for (const address of addresses) {
      const ok = await processAddress(address, payload, {
        dryRun: args.dryRun,
        skipTrulia: args.skipTrulia,
      });
      if (!ok) hadError = true;
    }
    console.log(`\nDone. Processed ${addresses.length} address(es).`);
  } finally {
    if (typeof payload.db.destroy === "function") await payload.db.destroy();
  }

  if (hadError) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
