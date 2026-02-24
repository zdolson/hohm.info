/**
 * Import listings by address via Zillow (Apify) + Trulia. Optional photo download + AI tag inference.
 * Run: pnpm import:address --address "Street, City, ST" [--file addresses.txt] [--dry-run] [--skip-trulia] [--skip-photos] [--skip-inference] [--auto-approve-tags] [--max-new-tags N] [--force-revalidate]
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { getPayload } from "payload";
import config from "../src/payload.config";
import { fetchZillow } from "./lib/fetchers/zillow";
import { fetchTruliaHistory } from "./lib/fetchers/trulia";
import { inferTagSlugs } from "./lib/infer-tags";
import { normalizeToListing } from "./lib/normalize";
import { downloadPhotos, uploadPhotosToMedia } from "./lib/download-photos";
import { createProvider, isLLMConfigured } from "./lib/llm/config";
import {
  inferTags,
  computeInputFingerprint,
  type InferenceInput,
} from "./lib/ai-tag-inference";
import { readMediaBytesBatch } from "./lib/media-bytes";
import { applyProposal } from "./lib/apply-proposal";
import { PROMPT_VERSION } from "./lib/llm/prompt";
import { proposalFileSchema } from "./lib/llm/schema";
import type { ScrapedEvent } from "./lib/fetcher";
import type { Listing, Media, Tag } from "@/payload-types";

const PROPOSALS_DIR = path.resolve(__dirname, "output", "tag-proposals");
const DEFAULT_MAX_NEW_TAGS = Math.max(
  0,
  parseInt(process.env.LLM_MAX_NEW_TAGS ?? "30", 10) || 30
);

function parseArgs() {
  const args = process.argv.slice(2);
  const addresses: string[] = [];
  const result = {
    addresses,
    file: undefined as string | undefined,
    dryRun: false,
    skipTrulia: false,
    skipPhotos: false,
    skipInference: false,
    autoApproveTags: false,
    maxNewTags: DEFAULT_MAX_NEW_TAGS,
    forceRevalidate: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--address") result.addresses.push(args[++i]);
    else if (args[i] === "--file") result.file = args[++i];
    else if (args[i] === "--dry-run") result.dryRun = true;
    else if (args[i] === "--skip-trulia") result.skipTrulia = true;
    else if (args[i] === "--skip-photos") result.skipPhotos = true;
    else if (args[i] === "--skip-inference") result.skipInference = true;
    else if (args[i] === "--auto-approve-tags") result.autoApproveTags = true;
    else if (args[i] === "--max-new-tags")
      result.maxNewTags = Math.max(0, parseInt(args[++i], 10) || 0);
    else if (args[i] === "--force-revalidate") result.forceRevalidate = true;
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
  opts: {
    dryRun: boolean;
    skipTrulia: boolean;
    skipPhotos: boolean;
    skipInference: boolean;
    autoApproveTags: boolean;
    maxNewTags: number;
    forceRevalidate: boolean;
  }
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
  let listingId: number;
  try {
    const created = await payload.create({
      collection: "listings",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payload create overloads conflict with ListingCreateData listingEvents typing
      data: listingData as any,
      overrideAccess: true,
    });
    listingId = created.id as number;
    console.log(`[CREATED] Listing: ${listingData.slug}`);
  } catch (err) {
    console.log(`[ERROR]   Create listing failed: ${(err as Error).message}`);
    return false;
  }

  // 8. Photo download + upload to media
  if (
    !opts.skipPhotos &&
    scraped.photoUrls !== undefined &&
    scraped.photoUrls.length > 0
  ) {
    try {
      const photos = await downloadPhotos(scraped.photoUrls, listingData.slug, {
        maxPhotos: parseInt(process.env.LLM_MAX_PHOTOS ?? "6", 10) || 6,
      });
      if (photos.length > 0) {
        const mediaIds = await uploadPhotosToMedia(
          photos,
          payload,
          listingData.slug
        );
        await payload.update({
          collection: "listings",
          id: listingId,
          data: { photos: mediaIds },
          overrideAccess: true,
        });
        console.log(
          `[PHOTOS] Uploaded ${mediaIds.length} photo(s) for ${listingData.slug}`
        );
      }
    } catch (err) {
      console.log(
        `[WARN]    Photo download/upload failed: ${(err as Error).message}`
      );
    }
  }

  // 9. AI tag inference (optional)
  if (!opts.skipInference && isLLMConfigured()) {
    try {
      const provider = createProvider();
      const tagsResult = await payload.find({
        collection: "tags",
        limit: 1000,
        depth: 0,
      });
      const catalogSlugToId = new Map<string, number>();
      const existingTagsForPrompt: InferenceInput["existingTags"] = [];
      for (const t of tagsResult.docs as Tag[]) {
        catalogSlugToId.set(t.slug, t.id);
        existingTagsForPrompt.push({
          slug: t.slug,
          name: t.name,
          category: t.category ?? "features",
          description: t.description ?? undefined,
        });
      }
      const listingWithPhotos = (await payload.findByID({
        collection: "listings",
        id: listingId,
        depth: 1,
      })) as Listing;
      const photoRefs = listingWithPhotos.photos ?? [];
      const mediaDocs = photoRefs.filter(
        (p): p is Media =>
          typeof p === "object" && p !== null && "filename" in p
      ) as Media[];
      const photoBuffers = (await readMediaBytesBatch(mediaDocs)).filter(
        (b): b is Buffer => b !== null
      );
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
      const input: InferenceInput = {
        listing: inferenceListing,
        photos: photoBuffers,
        existingTags: existingTagsForPrompt,
      };
      const fingerprint = computeInputFingerprint(
        input,
        provider.name,
        provider.config.model,
        PROMPT_VERSION
      );
      const proposalPath = path.join(PROPOSALS_DIR, `${listingData.slug}.json`);
      let skipRevalidation = false;
      if (fs.existsSync(proposalPath) && !opts.forceRevalidate) {
        try {
          const raw = JSON.parse(fs.readFileSync(proposalPath, "utf-8"));
          const parsed = proposalFileSchema.safeParse(raw);
          if (parsed.success && parsed.data.inputFingerprint === fingerprint) {
            skipRevalidation = true;
            console.log(
              `[SKIP]    Inference skipped (fingerprint unchanged, use --force-revalidate to re-run)`
            );
          }
        } catch {
          // ignore
        }
      }
      if (!skipRevalidation) {
        const result = await inferTags(provider, input, {
          maxNewTags: opts.maxNewTags,
        });
        console.log(
          `[TOKENS] input=${result.tokenUsage.inputTokens} output=${result.tokenUsage.outputTokens} model=${result.model}`
        );
        const proposal = {
          listingSlug: listingData.slug,
          generatedAt: new Date().toISOString(),
          provider: result.provider,
          model: result.model,
          inputFingerprint: fingerprint,
          promptVersion: PROMPT_VERSION,
          tokenUsage: result.tokenUsage,
          photosAnalyzed: photoBuffers.length,
          existingTagSlugs: result.existingTagSlugs,
          newTagProposals: result.newTagProposals,
          newCategoryProposals: result.newCategoryProposals,
        };
        if (opts.autoApproveTags) {
          await applyProposal(
            listingId,
            tagIds,
            result,
            catalogSlugToId,
            payload,
            { dryRun: opts.dryRun, maxNewTags: opts.maxNewTags }
          );
          if (!opts.dryRun)
            console.log(`[APPLIED] AI tags for ${listingData.slug}`);
        } else {
          fs.mkdirSync(PROPOSALS_DIR, { recursive: true });
          fs.writeFileSync(proposalPath, JSON.stringify(proposal, null, 2));
          console.log(`[PROPOSAL] ${proposalPath}`);
          console.log(`  Run: pnpm listing:apply-tags ${proposalPath}`);
        }
      }
    } catch (err) {
      console.log(`[WARN]    AI inference failed: ${(err as Error).message}`);
    }
  } else if (!opts.skipInference) {
    console.log(`[SKIP]    LLM not configured, skipping inference`);
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
        skipPhotos: args.skipPhotos,
        skipInference: args.skipInference,
        autoApproveTags: args.autoApproveTags,
        maxNewTags: args.maxNewTags,
        forceRevalidate: args.forceRevalidate,
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
