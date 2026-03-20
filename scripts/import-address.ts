/**
 * Import listings by address or URL. Optional photo download + AI tag inference.
 * Run: pnpm import:address --address "Street, City, ST" [--sources trulia|zillow|zillow,trulia]
 *      [--file addresses.txt] [--dry-run] [--skip-photos] [--skip-inference] [--batch]
 *      [--strict-sources] [--delay-ms N] [--force-refetch]
 *      [--auto-approve-tags] [--max-new-tags N] [--force-revalidate]
 * Default source: env IMPORT_DEFAULT_SOURCES or "trulia" (no API keys required).
 * --batch: defer inference and run one Gemini batch job (50% cost); Gemini only.
 * Trulia: use the exact URL from the listing page when possible (e.g. .../home/street-east-grand-rapids-mi-49506-23851881).
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { getPayload } from "payload";
import config from "../src/payload.config";
import { FetchError } from "./lib/fetcher";
import type { ScrapedProperty } from "./lib/fetcher";
import { resolveAdapters, mergeScraped } from "./lib/fetchers/index";
import { closeBrowser } from "./lib/browser";
import { inferTagSlugs } from "./lib/infer-tags";
import { normalizeToListing } from "./lib/normalize";
import { downloadPhotos, uploadPhotosToMedia } from "./lib/download-photos";
import { createProvider, isLLMConfigured } from "./lib/llm/config";
import {
  inferTags,
  computeInputFingerprint,
  type InferenceInput,
} from "./lib/ai-tag-inference";
import { applyProposal } from "./lib/apply-proposal";
import { PROMPT_VERSION } from "./lib/llm/prompt";
import { proposalFileSchema } from "./lib/llm/schema";
import type { Tag } from "@/payload-types";
import {
  setDebugMode,
  setDebugAddressSlug,
  getAddressDebugDir,
} from "./lib/debug.js";
import { inferTagsBatch, type BatchInferenceItem } from "./lib/llm/batch.js";

const PROPOSALS_DIR = path.resolve(__dirname, "output", "tag-proposals");
const SCRAPE_CACHE_DIR = path.resolve(__dirname, "output", "scrape-cache");

/** Derive expected state (e.g. "MI") from request address or Trulia URL for validation. */
function getExpectedStateFromRequest(address: string): string | undefined {
  const trimmed = address.trim();
  // Trulia URL: .../home/street-city-st-zip or .../home/...-st-zip-id
  const truliaMatch = trimmed.match(/trulia\.com\/home\/([^/?#]+)/i);
  if (truliaMatch !== null) {
    const slug = truliaMatch[1].toLowerCase();
    const stateMatch = slug.match(/-([a-z]{2})(?:-\d{5})?(?:-\d+)?$/);
    if (stateMatch !== null) return stateMatch[1].toUpperCase();
  }
  // Freeform: "Street, City, ST 12345" or "..., ST"
  const commaParts = trimmed.split(",").map((p) => p.trim());
  if (commaParts.length >= 3) {
    const last = commaParts[commaParts.length - 1];
    const stateMatch = last.match(/^([A-Za-z]{2})(?:\s+\d{5})?$/);
    if (stateMatch !== null) return stateMatch[1].toUpperCase();
  }
  return undefined;
}

/** Return true if scraped listing appears to match the requested address (same state). */
function scrapedMatchesRequest(
  scraped: ScrapedProperty,
  requestedAddress: string
): boolean {
  const expectedState = getExpectedStateFromRequest(requestedAddress);
  if (expectedState === undefined) return true; // can't validate, allow
  const scrapedState = (scraped.state ?? "").trim().toUpperCase();
  return scrapedState === expectedState;
}

/** When --batch: processAddress returns this instead of running inference. */
export interface DeferredInferencePayload {
  inferenceInput: InferenceInput;
  listingId: number;
  tagIds: number[];
  fingerprint: string;
  proposalPath: string;
  photoBuffers: Buffer[];
  catalogSlugToId: Map<string, number>;
  maxNewTags: number;
  listingSlug: string;
}
const DEFAULT_MAX_NEW_TAGS = Math.max(
  0,
  parseInt(process.env.LLM_MAX_NEW_TAGS ?? "30", 10) || 30
);

const sourceStats = new Map<
  string,
  { ok: number; fail: number; blocked: number }
>();

function bumpStat(
  source: string,
  field: "ok" | "fail",
  blocked?: boolean
): void {
  if (!sourceStats.has(source)) {
    sourceStats.set(source, { ok: 0, fail: 0, blocked: 0 });
  }
  const s = sourceStats.get(source)!;
  s[field]++;
  if (blocked === true) s.blocked++;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const addresses: string[] = [];
  const result = {
    addresses,
    file: undefined as string | undefined,
    sources: (process.env.IMPORT_DEFAULT_SOURCES ?? "trulia")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    dryRun: false,
    skipPhotos: false,
    skipInference: false,
    strictSources: false,
    autoApproveTags: false,
    maxNewTags: DEFAULT_MAX_NEW_TAGS,
    forceRevalidate: false,
    forceRefetch: false,
    debug: false,
    batch: false,
    delayMs: Math.max(
      0,
      parseInt(process.env.IMPORT_DELAY_MS ?? "5000", 10) || 5000
    ),
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--address") result.addresses.push(args[++i]);
    else if (args[i] === "--file") result.file = args[++i];
    else if (args[i] === "--sources")
      result.sources = args[++i]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    else if (args[i] === "--skip-trulia") {
      console.warn(
        "[WARN]    --skip-trulia is deprecated. Use --sources zillow"
      );
      result.sources = ["zillow"];
    } else if (args[i] === "--dry-run") result.dryRun = true;
    else if (args[i] === "--skip-photos") result.skipPhotos = true;
    else if (args[i] === "--skip-inference") result.skipInference = true;
    else if (args[i] === "--strict-sources") result.strictSources = true;
    else if (args[i] === "--auto-approve-tags") result.autoApproveTags = true;
    else if (args[i] === "--max-new-tags")
      result.maxNewTags = Math.max(0, parseInt(args[++i], 10) || 0);
    else if (args[i] === "--force-revalidate") result.forceRevalidate = true;
    else if (args[i] === "--force-refetch") result.forceRefetch = true;
    else if (args[i] === "--debug") result.debug = true;
    else if (args[i] === "--batch") result.batch = true;
    else if (args[i] === "--delay-ms")
      result.delayMs = Math.max(0, parseInt(args[++i], 10) || 0);
  }
  return result;
}

async function processAddress(
  address: string,
  payload: Awaited<ReturnType<typeof getPayload>>,
  opts: {
    sources: string[];
    dryRun: boolean;
    skipPhotos: boolean;
    skipInference: boolean;
    strictSources: boolean;
    autoApproveTags: boolean;
    maxNewTags: number;
    forceRevalidate: boolean;
    forceRefetch: boolean;
    debug: boolean;
    returnDeferredInference?: boolean;
  }
): Promise<boolean | { deferred: DeferredInferencePayload }> {
  const tAddress = Date.now();
  console.log(`\n[ADDRESS] ${address}`);

  // 1. Check scrape cache
  const cacheSlug = address
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const cachePath = path.join(SCRAPE_CACHE_DIR, `${cacheSlug}.json`);

  if (opts.debug) {
    setDebugAddressSlug(cacheSlug);
    const dir = getAddressDebugDir();
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    fs.mkdirSync(dir, { recursive: true });
  }

  let scraped: ScrapedProperty | null = null;

  try {
    if (!opts.forceRefetch && fs.existsSync(cachePath)) {
      try {
        const parsed = JSON.parse(
          fs.readFileSync(cachePath, "utf-8")
        ) as ScrapedProperty;
        if (
          typeof parsed.address === "string" &&
          typeof parsed.city === "string" &&
          typeof parsed.state === "string"
        ) {
          if (!scrapedMatchesRequest(parsed, address)) {
            console.log(
              `[CACHE]   Cached scrape is for ${parsed.address}, ${parsed.city}, ${parsed.state} but request was for ${address}; invalidating and re-fetching.`
            );
            try {
              fs.unlinkSync(cachePath);
            } catch {
              // ignore
            }
          } else {
            scraped = parsed;
            console.log(`[CACHE]   Using cached scrape for: ${address}`);
          }
        } else {
          console.log(
            `[CACHE]   Cache schema mismatch, re-fetching: ${address}`
          );
        }
      } catch {
        // invalid cache file, re-fetch
      }
    }

    // 2. Fetch from sources (if not cached)
    if (scraped === null) {
      const adapters = resolveAdapters(opts.sources);
      const results: Array<{ source: string; data: ScrapedProperty }> = [];
      for (const adapter of adapters) {
        try {
          const data = await adapter.fetch(address);
          console.log(
            `[FETCHED] ${adapter.name}: ${data.address}, ${data.city}, ${data.state}`
          );
          results.push({ source: adapter.name, data });
          bumpStat(adapter.name, "ok");
        } catch (err) {
          const isBlocked = err instanceof FetchError && err.code === "blocked";
          const prefix = isBlocked
            ? "[BLOCKED]"
            : err instanceof FetchError && err.code === "notFound"
              ? "[NOT_FOUND]"
              : "[ERROR]  ";
          console.log(`${prefix} ${adapter.name}: ${(err as Error).message}`);
          bumpStat(adapter.name, "fail", isBlocked);
          if (opts.strictSources) return false;
        }
      }
      if (results.length === 0) {
        console.log(`[ERROR]   All sources failed for: ${address}`);
        return false;
      }
      scraped = results.length === 1 ? results[0].data : mergeScraped(results);

      if (!scrapedMatchesRequest(scraped, address)) {
        console.log(
          `[ERROR]   Fetched listing is for ${scraped.address}, ${scraped.city}, ${scraped.state} but request was for ${address}. Trulia may have returned the wrong page.`
        );
        console.log(
          `[ERROR]   Use the exact Trulia URL from the listing page (includes city/neighborhood and listing ID), e.g. https://www.trulia.com/home/2114-anderson-dr-se-east-grand-rapids-mi-49506-23851881`
        );
        return false;
      }

      // Write to scrape cache
      fs.mkdirSync(SCRAPE_CACHE_DIR, { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(scraped, null, 2));
    }

    if (opts.debug && scraped !== null) {
      fs.writeFileSync(
        path.join(getAddressDebugDir(), "scraped.json"),
        JSON.stringify(scraped, null, 2)
      );
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

    // 6. Download photos to memory (needed for both upload and inference)
    const maxPhotos = parseInt(process.env.LLM_MAX_PHOTOS ?? "6", 10) || 6;
    let downloadedPhotos: Awaited<ReturnType<typeof downloadPhotos>> = [];
    if (opts.skipPhotos) {
      console.log(`[PHOTOS]  Skipped (--skip-photos)`);
    } else if (
      scraped.photoUrls === undefined ||
      scraped.photoUrls.length === 0
    ) {
      console.log(`[PHOTOS]  No photo URLs found in scraped data`);
    } else {
      try {
        downloadedPhotos = await downloadPhotos(
          scraped.photoUrls,
          listingData.slug,
          { maxPhotos }
        );
        console.log(
          `[PHOTOS]  Downloaded ${downloadedPhotos.length} photo(s) to memory`
        );
      } catch (err) {
        console.log(
          `[WARN]    Photo download failed: ${(err as Error).message}`
        );
      }
    }

    // 7. Skip if exists
    const existing = await payload.find({
      collection: "listings",
      where: { slug: { equals: listingData.slug } },
      limit: 1,
    });

    if (existing.docs.length > 0) {
      console.log(`[SKIP]    Listing already exists: ${listingData.slug}`);
      return true;
    }

    // 8. Create listing + upload photos (skip in dry-run)
    let listingId: number | null = null;
    if (opts.dryRun) {
      console.log(`[DRY-RUN] Would create listing: ${listingData.slug}`);
    } else {
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
        console.log(
          `[ERROR]   Create listing failed: ${(err as Error).message}`
        );
        return false;
      }

      if (downloadedPhotos.length > 0) {
        try {
          const mediaIds = await uploadPhotosToMedia(
            downloadedPhotos,
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
            `[PHOTOS]  Uploaded ${mediaIds.length} photo(s) for ${listingData.slug}`
          );
        } catch (err) {
          console.log(
            `[WARN]    Photo upload failed: ${(err as Error).message}`
          );
        }
      }
    }

    // 9. AI tag inference — uses downloaded photo buffers directly (works in dry-run)
    const hasUsefulInferenceInput =
      downloadedPhotos.length > 0 ||
      scraped.rawAttributes.length > 0 ||
      (scraped.description !== undefined && scraped.description.length > 20);

    if (opts.skipInference) {
      console.log(`[SKIP]    Inference skipped (--skip-inference)`);
    } else if (!isLLMConfigured()) {
      console.log(`[SKIP]    LLM not configured, skipping inference`);
    } else if (!hasUsefulInferenceInput) {
      console.log(
        `[SKIP]    Inference skipped — no photos, attributes, or description to analyze`
      );
    } else {
      const proposalPath = path.join(PROPOSALS_DIR, `${listingData.slug}.json`);
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
      const photoBuffers = downloadedPhotos.map((p) => p.buffer);
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
      if (opts.returnDeferredInference === true && !skipRevalidation) {
        if (listingId === null) {
          console.log(
            `[WARN]    Batch deferred but listing not created (dry-run?); skipping inference for ${listingData.slug}`
          );
        } else {
          return {
            deferred: {
              inferenceInput: input,
              listingId,
              tagIds,
              fingerprint,
              proposalPath,
              photoBuffers,
              catalogSlugToId,
              maxNewTags: opts.maxNewTags,
              listingSlug: listingData.slug,
            },
          };
        }
      } else if (!skipRevalidation) {
        console.log(
          `[INFER]   Starting AI tag inference (${downloadedPhotos.length} photos, ${scraped.rawAttributes.length} attributes)...`
        );
        try {
          const result = await inferTags(provider, input, {
            maxNewTags: opts.maxNewTags,
            debug: opts.debug,
          });
          console.log(
            `[TOKENS]  input=${result.tokenUsage.inputTokens} output=${result.tokenUsage.outputTokens} model=${result.model}`
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
          if (opts.autoApproveTags && listingId !== null) {
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
            if (!opts.dryRun)
              console.log(`  Run: pnpm listing:apply-tags ${proposalPath}`);
          }
        } catch (err) {
          console.log(
            `[WARN]    AI inference failed: ${(err as Error).message}`
          );
        }
      }
    }

    const elapsed = ((Date.now() - tAddress) / 1000).toFixed(1);
    console.log(`[ADDRESS] ${address} done [${elapsed}s]\n`);
    return true;
  } finally {
    setDebugAddressSlug(null);
  }
}

async function main() {
  const args = parseArgs();
  setDebugMode(args.debug);

  const addresses = [...args.addresses];
  if (args.file) {
    const lines = fs
      .readFileSync(args.file, "utf-8")
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
    if (args.batch) {
      if (args.skipInference) {
        console.error(
          "[ERROR] --batch and --skip-inference cannot be used together."
        );
        process.exit(1);
      }
      const provider = createProvider();
      if (provider.name !== "gemini") {
        console.error(
          "[ERROR] --batch is only supported with Gemini. Set LLM_PROVIDER=gemini and GEMINI_API_KEY."
        );
        process.exit(1);
      }
      const deferredList: DeferredInferencePayload[] = [];
      for (let i = 0; i < addresses.length; i++) {
        const result = await processAddress(addresses[i], payload, {
          sources: args.sources,
          dryRun: args.dryRun,
          skipPhotos: args.skipPhotos,
          skipInference: false,
          strictSources: args.strictSources,
          autoApproveTags: args.autoApproveTags,
          maxNewTags: args.maxNewTags,
          forceRevalidate: args.forceRevalidate,
          forceRefetch: args.forceRefetch,
          debug: args.debug,
          returnDeferredInference: true,
        });
        if (result === false) hadError = true;
        else if (typeof result === "object" && "deferred" in result) {
          deferredList.push(result.deferred);
        }
        if (i < addresses.length - 1 && args.delayMs > 0) {
          console.log(`[WAIT]    ${args.delayMs}ms before next address...`);
          await new Promise((r) => setTimeout(r, args.delayMs));
        }
      }
      if (deferredList.length > 0) {
        const batchItems: BatchInferenceItem[] = deferredList.map((d) => ({
          input: d.inferenceInput,
          opts: { maxNewTags: d.maxNewTags },
        }));
        const results = await inferTagsBatch(provider.config, batchItems);
        for (let i = 0; i < results.length; i++) {
          const d = deferredList[i];
          const result = results[i];
          if (result === null) {
            console.log(
              `[SKIP]    ${d.listingSlug} — batch item failed, no tags applied`
            );
            hadError = true;
            continue;
          }
          console.log(
            `[TOKENS]  ${d.listingSlug} input=${result.tokenUsage.inputTokens} output=${result.tokenUsage.outputTokens} model=${result.model}`
          );
          const proposal = {
            listingSlug: d.listingSlug,
            generatedAt: new Date().toISOString(),
            provider: result.provider,
            model: result.model,
            inputFingerprint: d.fingerprint,
            promptVersion: PROMPT_VERSION,
            tokenUsage: result.tokenUsage,
            photosAnalyzed: d.photoBuffers.length,
            existingTagSlugs: result.existingTagSlugs,
            newTagProposals: result.newTagProposals,
            newCategoryProposals: result.newCategoryProposals,
          };
          if (args.autoApproveTags) {
            await applyProposal(
              d.listingId,
              d.tagIds,
              result,
              d.catalogSlugToId,
              payload,
              { dryRun: args.dryRun, maxNewTags: args.maxNewTags }
            );
            if (!args.dryRun)
              console.log(`[APPLIED] AI tags for ${d.listingSlug}`);
          } else {
            fs.mkdirSync(PROPOSALS_DIR, { recursive: true });
            fs.writeFileSync(d.proposalPath, JSON.stringify(proposal, null, 2));
            console.log(`[PROPOSAL] ${d.proposalPath}`);
            if (!args.dryRun)
              console.log(`  Run: pnpm listing:apply-tags ${d.proposalPath}`);
          }
        }
      }
    } else {
      for (let i = 0; i < addresses.length; i++) {
        const ok = await processAddress(addresses[i], payload, {
          sources: args.sources,
          dryRun: args.dryRun,
          skipPhotos: args.skipPhotos,
          skipInference: args.skipInference,
          strictSources: args.strictSources,
          autoApproveTags: args.autoApproveTags,
          maxNewTags: args.maxNewTags,
          forceRevalidate: args.forceRevalidate,
          forceRefetch: args.forceRefetch,
          debug: args.debug,
        });
        if (ok === false) hadError = true;

        if (i < addresses.length - 1 && args.delayMs > 0) {
          console.log(`[WAIT]    ${args.delayMs}ms before next address...`);
          await new Promise((r) => setTimeout(r, args.delayMs));
        }
      }
    }

    // Per-source stats summary
    if (sourceStats.size > 0) {
      console.log(`\n[STATS]   Source results:`);
      for (const [name, s] of sourceStats) {
        console.log(
          `[STATS]     ${name}: ${s.ok} ok, ${s.fail} fail (${s.blocked} blocked)`
        );
      }
    }

    console.log(`\nDone. Processed ${addresses.length} address(es).`);
  } finally {
    await closeBrowser();
    if (typeof payload.db.destroy === "function") await payload.db.destroy();
  }

  process.exit(hadError ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
