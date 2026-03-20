/**
 * Temporary script to compare cost: single call with up to 60 photos vs chunked batch (e.g. 3×20).
 * Run: pnpm exec tsx scripts/test-inference-cost.ts [--address "URL or address"]
 * Requires: LLM_PROVIDER=gemini, GEMINI_API_KEY. Uses scrape cache or fetches once.
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { getPayload } from "payload";
import config from "../src/payload.config";
import type { ScrapedProperty } from "./lib/fetcher";
import { resolveAdapters, mergeScraped } from "./lib/fetchers/index";
import { closeBrowser } from "./lib/browser";
import { inferTagSlugs } from "./lib/infer-tags";
import { normalizeToListing } from "./lib/normalize";
import { downloadPhotos } from "./lib/download-photos";
import { createProvider } from "./lib/llm/config";
import {
  inferTags,
  type InferenceInput,
  type InferenceResult,
} from "./lib/ai-tag-inference";
import { inferTagsBatch, type BatchInferenceItem } from "./lib/llm/batch.js";
import type { Tag } from "@/payload-types";

const SCRAPE_CACHE_DIR = path.resolve(__dirname, "output", "scrape-cache");
const TEST_MAX_PHOTOS = 60;
const CHUNK_SIZE = 20;

const DEFAULT_ADDRESS =
  "https://www.trulia.com/home/408-w-king-st-owosso-mi-48867-122608427/";

function parseArgs(): { address: string } {
  const args = process.argv.slice(2);
  let address = DEFAULT_ADDRESS;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--address") address = args[++i] ?? address;
  }
  return { address };
}

/** Merge chunked batch results into one (dedupe by slug). */
function mergeBatchResults(
  results: (InferenceResult | null)[]
): InferenceResult | null {
  const valid = results.filter((r): r is InferenceResult => r !== null);
  if (valid.length === 0) return null;
  const first = valid[0];
  const seenTagSlug = new Set<string>();
  const seenCategorySlug = new Set<string>();
  const newTagProposals: InferenceResult["newTagProposals"] = [];
  const newCategoryProposals: InferenceResult["newCategoryProposals"] = [];
  for (const r of valid) {
    for (const p of r.newTagProposals) {
      if (seenTagSlug.has(p.slug)) continue;
      seenTagSlug.add(p.slug);
      newTagProposals.push(p);
    }
    for (const p of r.newCategoryProposals) {
      if (seenCategorySlug.has(p.slug)) continue;
      seenCategorySlug.add(p.slug);
      newCategoryProposals.push(p);
    }
  }
  const totalInput = valid.reduce((s, r) => s + r.tokenUsage.inputTokens, 0);
  const totalOutput = valid.reduce((s, r) => s + r.tokenUsage.outputTokens, 0);
  const totalCost = valid.reduce((s, r) => s + (r.estimatedCost ?? 0), 0);
  return {
    ...first,
    existingTagSlugs: first.existingTagSlugs,
    newTagProposals,
    newCategoryProposals,
    tokenUsage: { inputTokens: totalInput, outputTokens: totalOutput },
    estimatedCost: totalCost,
  };
}

async function main(): Promise<void> {
  const { address } = parseArgs();
  console.log(
    "[TEST] Inference cost comparison (single 60-photo vs chunked batch)\n"
  );
  console.log(`[TEST] Address: ${address}\n`);

  const payload = await getPayload({ config });
  const provider = createProvider();
  if (provider.name !== "gemini") {
    console.error(
      "[ERROR] This test requires Gemini. Set LLM_PROVIDER=gemini and GEMINI_API_KEY."
    );
    process.exit(1);
  }

  const cacheSlug = address
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const cachePath = path.join(SCRAPE_CACHE_DIR, `${cacheSlug}.json`);

  let scraped: ScrapedProperty;
  if (fs.existsSync(cachePath)) {
    scraped = JSON.parse(
      fs.readFileSync(cachePath, "utf-8")
    ) as ScrapedProperty;
    console.log("[CACHE] Using cached scrape.");
  } else {
    console.log("[FETCH] No cache; fetching...");
    const adapters = resolveAdapters(["trulia"]);
    const results: Array<{ source: string; data: ScrapedProperty }> = [];
    for (const adapter of adapters) {
      const data = await adapter.fetch(address);
      results.push({ source: adapter.name, data });
    }
    scraped = results.length === 1 ? results[0].data : mergeScraped(results);
    fs.mkdirSync(SCRAPE_CACHE_DIR, { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(scraped, null, 2));
    console.log("[FETCH] Done.");
  }
  await closeBrowser();

  const tagSlugs = inferTagSlugs(scraped.rawAttributes);
  const tagIds: number[] = [];
  for (const slug of tagSlugs) {
    const existing = await payload.find({
      collection: "tags",
      where: { slug: { equals: slug } },
      limit: 1,
    });
    if (existing.docs.length > 0) {
      tagIds.push(existing.docs[0].id as number);
    }
  }
  const listingData = normalizeToListing(scraped, tagIds);

  const downloadedPhotos = await downloadPhotos(
    scraped.photoUrls ?? [],
    listingData.slug,
    { maxPhotos: TEST_MAX_PHOTOS }
  );
  const photoBuffers = downloadedPhotos.map((p) => p.buffer);
  console.log(`[TEST] Photos available: ${photoBuffers.length}`);
  if (photoBuffers.length < TEST_MAX_PHOTOS) {
    console.log(
      `[TEST] (For a 60-photo comparison, use an address whose scrape has ≥60 photo URLs.)\n`
    );
  } else {
    console.log("");
  }

  if (photoBuffers.length === 0) {
    console.error("[ERROR] No photos; cannot run test.");
    process.exit(1);
  }

  const tagsResult = await payload.find({
    collection: "tags",
    limit: 1000,
    depth: 0,
  });
  const existingTags: InferenceInput["existingTags"] = (
    tagsResult.docs as Tag[]
  ).map((t) => ({
    slug: t.slug,
    name: t.name,
    category: t.category ?? "features",
    description: t.description ?? undefined,
  }));
  const inferenceListing: InferenceInput["listing"] = {
    slug: listingData.slug,
    address: listingData.address,
    city: listingData.city,
    state: listingData.state,
    yearBuilt: listingData.yearBuilt,
    price: listingData.price,
    description: scraped.description,
    property: listingData.property,
    interior: listingData.interior,
    lot: listingData.lot,
    garageSpaces: listingData.garageSpaces,
    rawAttributes: scraped.rawAttributes,
  };
  const baseInput: InferenceInput = {
    listing: inferenceListing,
    photos: photoBuffers,
    existingTags,
  };

  const photosForTest = photoBuffers.slice(0, TEST_MAX_PHOTOS);
  const inputSingle: InferenceInput = {
    ...baseInput,
    photos: photosForTest,
  };

  // —— Single call (up to 60 photos) ——
  console.log("——— Single call (up to 60 photos) ———");
  const tSingle = Date.now();
  let resultSingle: InferenceResult | null = null;
  try {
    resultSingle = await inferTags(provider, inputSingle, {
      maxNewTags: 30,
      maxTokens: 8192,
    });
  } catch (err) {
    console.error("[ERROR] Single call failed:", (err as Error).message);
  }
  const elapsedSingle = ((Date.now() - tSingle) / 1000).toFixed(1);
  if (resultSingle !== null) {
    console.log(
      `[SINGLE] Done in ${elapsedSingle}s. Tokens: in=${resultSingle.tokenUsage.inputTokens} out=${resultSingle.tokenUsage.outputTokens}`
    );
    console.log(
      `[SINGLE] Cost: $${(resultSingle.estimatedCost ?? 0).toFixed(4)}`
    );
  }

  // —— Chunked batch (e.g. 3×20) ——
  console.log("\n——— Chunked batch ———");
  const chunks: Buffer[][] = [];
  for (let i = 0; i < photosForTest.length; i += CHUNK_SIZE) {
    chunks.push(photosForTest.slice(i, i + CHUNK_SIZE));
  }
  console.log(
    `[BATCH] ${chunks.length} chunk(s), ${CHUNK_SIZE} photos each (last may be smaller).`
  );
  const batchItems: BatchInferenceItem[] = chunks.map((photos) => ({
    input: { ...baseInput, photos },
    opts: { maxNewTags: 30, maxTokens: 8192 },
  }));

  const tBatch = Date.now();
  let batchResults: (InferenceResult | null)[];
  try {
    batchResults = await inferTagsBatch(provider.config, batchItems);
  } catch (err) {
    console.error("[ERROR] Batch failed:", (err as Error).message);
    batchResults = [];
  }
  const elapsedBatch = ((Date.now() - tBatch) / 1000).toFixed(1);
  const merged = mergeBatchResults(batchResults);
  if (merged !== null) {
    console.log(
      `[BATCH] Done in ${elapsedBatch}s. Tokens: in=${merged.tokenUsage.inputTokens} out=${merged.tokenUsage.outputTokens}`
    );
    console.log(
      `[BATCH] Cost (sum): $${(merged.estimatedCost ?? 0).toFixed(4)}`
    );
  }

  // —— Summary ——
  console.log("\n========== Summary ==========");
  if (resultSingle !== null && merged !== null) {
    const costSingle = resultSingle.estimatedCost ?? 0;
    const costBatch = merged.estimatedCost ?? 0;
    console.log(`Single call:  $${costSingle.toFixed(4)}  (${elapsedSingle}s)`);
    console.log(`Chunked batch: $${costBatch.toFixed(4)}  (${elapsedBatch}s)`);
    console.log(
      `Difference: ${costBatch >= costSingle ? "+" : ""}$${(costBatch - costSingle).toFixed(4)} (batch ${costBatch >= costSingle ? "more" : "less"} expensive)`
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
