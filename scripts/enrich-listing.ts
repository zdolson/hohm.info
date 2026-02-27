/**
 * Enrich listing(s) with AI-inferred tags. Writes proposal JSON or applies to DB.
 * Run: pnpm listing:enrich --slug <slug> | --all [--force] [--force-revalidate] [--auto-approve-tags] [--dry-run] [--max-new-tags N] [--no-tag-limit]
 */
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.resolve(ROOT, ".env.local") });

import { getPayload } from "payload";
import config from "../src/payload.config";
import { createProvider } from "./lib/llm/config";
import {
  inferTags,
  computeInputFingerprint,
  type InferenceInput,
} from "./lib/ai-tag-inference";
import { PROMPT_VERSION } from "./lib/llm/prompt";
import { applyProposal } from "./lib/apply-proposal";
import { readMediaBytesBatch } from "./lib/media-bytes";
import { proposalFileSchema } from "./lib/llm/schema";
import type { Listing, Media, Tag } from "@/payload-types";
import {
  setDebugMode,
  setDebugAddressSlug,
  getAddressDebugDir,
} from "./lib/debug.js";

const PROPOSALS_DIR = path.resolve(__dirname, "output", "tag-proposals");
const DEFAULT_MAX_NEW_TAGS = Math.max(
  0,
  parseInt(process.env.LLM_MAX_NEW_TAGS ?? "30", 10) || 30
);

function parseArgs(): {
  slug?: string;
  all: boolean;
  force: boolean;
  forceRevalidate: boolean;
  autoApproveTags: boolean;
  dryRun: boolean;
  maxNewTags: number;
  noTagLimit: boolean;
  debug: boolean;
} {
  const args = process.argv.slice(2);
  let slug: string | undefined;
  let all = false;
  let force = false;
  let forceRevalidate = false;
  let autoApproveTags = false;
  let dryRun = false;
  let maxNewTags = DEFAULT_MAX_NEW_TAGS;
  let noTagLimit = false;
  let debug = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--slug") slug = args[++i];
    else if (args[i] === "--all") all = true;
    else if (args[i] === "--force") force = true;
    else if (args[i] === "--force-revalidate") forceRevalidate = true;
    else if (args[i] === "--auto-approve-tags") autoApproveTags = true;
    else if (args[i] === "--dry-run") dryRun = true;
    else if (args[i] === "--debug") debug = true;
    else if (args[i] === "--max-new-tags")
      maxNewTags = Math.max(0, parseInt(args[++i], 10) || 0);
    else if (args[i] === "--no-tag-limit") noTagLimit = true;
  }
  if (noTagLimit) maxNewTags = 9999;
  return {
    slug,
    all,
    force,
    forceRevalidate,
    autoApproveTags,
    dryRun,
    maxNewTags,
    noTagLimit,
    debug,
  };
}

function listingToInferenceListing(l: Listing): InferenceInput["listing"] {
  return {
    slug: l.slug,
    address: l.address ?? "",
    city: l.city ?? "",
    state: l.state ?? "",
    yearBuilt: l.yearBuilt ?? undefined,
    price: l.price ?? undefined,
    description: l.summary ?? undefined,
    property: l.property
      ? {
          propertyType: l.property.propertyType ?? undefined,
          status: l.property.status ?? undefined,
          stories: l.property.stories ?? undefined,
        }
      : undefined,
    interior: l.interior
      ? {
          bedrooms: l.interior.bedrooms ?? undefined,
          bathroomsFull: l.interior.bathroomsFull ?? undefined,
          bathroomsHalf: l.interior.bathroomsHalf ?? undefined,
          squareFootage: l.interior.squareFootage ?? undefined,
          fireplaces: l.interior.fireplaces ?? undefined,
        }
      : undefined,
    lot:
      l.lot?.lotSize !== undefined && l.lot?.lotSize !== null
        ? { lotSize: l.lot.lotSize! }
        : undefined,
    garageSpaces: l.garageSpaces ?? undefined,
    // rawAttributes aren't stored on the Listing record — normalized away at ingest.
    // import-address passes them from the scraper; re-enrichment here can't recover them.
    rawAttributes: [],
  };
}

async function fetchAllTags(payload: Awaited<ReturnType<typeof getPayload>>) {
  const all: Tag[] = [];
  let page = 1;
  for (;;) {
    const result = await payload.find({
      collection: "tags",
      limit: 200,
      page,
      depth: 0,
    });
    all.push(...(result.docs as Tag[]));
    if (!result.hasNextPage) break;
    page++;
  }
  return all;
}

async function fetchAllListings(
  payload: Awaited<ReturnType<typeof getPayload>>
) {
  const all: Listing[] = [];
  let page = 1;
  for (;;) {
    const result = await payload.find({
      collection: "listings",
      limit: 100,
      page,
      depth: 1,
    });
    all.push(...(result.docs as Listing[]));
    if (!result.hasNextPage) break;
    page++;
  }
  return all;
}

async function main(): Promise<void> {
  const opts = parseArgs();
  setDebugMode(opts.debug);

  if (opts.slug === undefined && !opts.all) {
    console.error("Usage: pnpm listing:enrich --slug <slug> | --all [options]");
    process.exit(1);
  }
  if (opts.slug !== undefined && opts.all) {
    console.error("Use either --slug or --all, not both.");
    process.exit(1);
  }

  const payload = await getPayload({ config });
  try {
    const provider = createProvider();
    const maxNewTags = opts.maxNewTags;

    const allTags = await fetchAllTags(payload);
    const catalogSlugToId = new Map<string, number>();
    const existingTagsForPrompt: InferenceInput["existingTags"] = [];
    for (const t of allTags) {
      catalogSlugToId.set(t.slug, t.id);
      existingTagsForPrompt.push({
        slug: t.slug,
        name: t.name,
        category: t.category ?? "features",
        description: t.description ?? undefined,
      });
    }

    let listings: Listing[];
    if (opts.slug !== undefined) {
      const found = await payload.find({
        collection: "listings",
        where: { slug: { equals: opts.slug } },
        limit: 1,
        depth: 1,
      });
      if (found.docs.length === 0) {
        console.error(`[ERROR] Listing not found: ${opts.slug}`);
        process.exit(1);
      }
      listings = found.docs as Listing[];
    } else {
      listings = await fetchAllListings(payload);
    }

    for (const listing of listings) {
      const tListing = Date.now();
      const currentTagIds = (listing.tags ?? [])
        .map((x) => (typeof x === "number" ? x : (x as Tag).id))
        .filter((id): id is number => typeof id === "number");
      if (currentTagIds.length > 0 && !opts.force) {
        console.log(
          `[SKIP] ${listing.slug} — already has tags (use --force to re-run)`
        );
        continue;
      }

      const photoRefs = listing.photos ?? [];
      const mediaDocs = photoRefs.filter(
        (p): p is Media =>
          typeof p === "object" && p !== null && "filename" in p
      ) as Media[];
      const photoBuffers = (await readMediaBytesBatch(mediaDocs)).filter(
        (b): b is Buffer => b !== null
      );

      const inferenceListing = listingToInferenceListing(listing);
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

      const proposalPath = path.join(PROPOSALS_DIR, `${listing.slug}.json`);
      let skipRevalidation = false;
      if (fs.existsSync(proposalPath) && !opts.forceRevalidate) {
        try {
          const raw = JSON.parse(fs.readFileSync(proposalPath, "utf-8"));
          const parsed = proposalFileSchema.safeParse(raw);
          if (parsed.success && parsed.data.inputFingerprint === fingerprint) {
            skipRevalidation = true;
            console.log(
              `[SKIP] ${listing.slug} — revalidation not forced, fingerprint unchanged`
            );
          }
        } catch {
          // ignore
        }
      }
      if (skipRevalidation) continue;

      if (opts.debug) {
        setDebugAddressSlug(listing.slug);
        const dir = getAddressDebugDir();
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
        fs.mkdirSync(dir, { recursive: true });
      }

      let result;
      try {
        result = await inferTags(provider, input, {
          maxNewTags,
          debug: opts.debug,
        });
      } catch (err) {
        console.error(
          `[VALIDATION ERROR] ${listing.slug}: ${(err as Error).message}`
        );
        setDebugAddressSlug(null);
        continue;
      }
      console.log(
        `[TOKENS] ${listing.slug} input=${result.tokenUsage.inputTokens} output=${result.tokenUsage.outputTokens} model=${result.model} provider=${result.provider}`
      );

      const proposal = {
        listingSlug: listing.slug,
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
          listing.id,
          currentTagIds,
          result,
          catalogSlugToId,
          payload,
          { dryRun: opts.dryRun, maxNewTags }
        );
        if (opts.dryRun) {
          console.log(`[DRY-RUN] ${listing.slug} — no DB writes`);
        } else {
          console.log(`[APPLIED] ${listing.slug}`);
        }
      } else {
        fs.mkdirSync(PROPOSALS_DIR, { recursive: true });
        fs.writeFileSync(proposalPath, JSON.stringify(proposal, null, 2));
        console.log(`[PROPOSAL] ${proposalPath}`);
        console.log(
          `  Run: pnpm listing:apply-tags ${proposalPath}${opts.dryRun ? " --dry-run" : ""}`
        );
      }
      const elapsed = ((Date.now() - tListing) / 1000).toFixed(1);
      console.log(`[ENRICH] ${listing.slug} done [${elapsed}s]`);
      setDebugAddressSlug(null);
    }
  } finally {
    if (typeof payload.db.destroy === "function") await payload.db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
