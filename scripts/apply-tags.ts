/**
 * Apply a saved tag proposal JSON to the DB.
 * Run: pnpm listing:apply-tags <path-to-proposal.json> [--dry-run] [--max-new-tags N] [--no-tag-limit] [--apply-reclassifications]
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
import { applyProposal } from "./lib/apply-proposal";
import { proposalFileSchema } from "./lib/llm/schema";
import type { Tag } from "@/payload-types";

const DEFAULT_MAX_NEW_TAGS = Math.max(
  0,
  parseInt(process.env.LLM_MAX_NEW_TAGS ?? "30", 10) || 30
);

function parseArgs(): {
  file: string;
  dryRun: boolean;
  maxNewTags: number;
  applyReclassifications: boolean;
} {
  const args = process.argv.slice(2);
  let file = "";
  let dryRun = false;
  let maxNewTags = DEFAULT_MAX_NEW_TAGS;
  let applyReclassifications = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") dryRun = true;
    else if (args[i] === "--max-new-tags")
      maxNewTags = Math.max(0, parseInt(args[++i], 10) || 0);
    else if (args[i] === "--no-tag-limit") maxNewTags = 9999;
    else if (args[i] === "--apply-reclassifications")
      applyReclassifications = true;
    else if (!args[i].startsWith("--")) file = args[i];
  }
  return { file, dryRun, maxNewTags, applyReclassifications };
}

async function main(): Promise<void> {
  const opts = parseArgs();
  if (opts.file === "") {
    console.error(
      "Usage: pnpm listing:apply-tags <proposal.json> [--dry-run] [--max-new-tags N] [--apply-reclassifications]"
    );
    process.exit(1);
  }
  const absPath = path.isAbsolute(opts.file)
    ? opts.file
    : path.resolve(process.cwd(), opts.file);
  if (!fs.existsSync(absPath)) {
    console.error(`[ERROR] File not found: ${absPath}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(absPath, "utf-8"));
  const parsed = proposalFileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[ERROR] Invalid proposal file:", parsed.error.message);
    process.exit(1);
  }
  const proposal = parsed.data;

  const payload = await getPayload({ config });
  const listingResult = await payload.find({
    collection: "listings",
    where: { slug: { equals: proposal.listingSlug } },
    limit: 1,
    depth: 0,
  });
  if (listingResult.docs.length === 0) {
    console.error(`[ERROR] Listing not found: ${proposal.listingSlug}`);
    if (typeof payload.db.destroy === "function") await payload.db.destroy();
    process.exit(1);
  }
  const listing = listingResult.docs[0];
  const currentTagIds = (listing.tags ?? [])
    .map((x) => (typeof x === "number" ? x : (x as Tag).id))
    .filter((id): id is number => typeof id === "number");

  const tagsResult = await payload.find({
    collection: "tags",
    limit: 1000,
    depth: 0,
  });
  const catalogSlugToId = new Map<string, number>();
  for (const t of tagsResult.docs as Tag[]) {
    catalogSlugToId.set(t.slug, t.id);
  }

  await applyProposal(
    listing.id,
    currentTagIds,
    {
      existingTagSlugs: proposal.existingTagSlugs,
      newTagProposals: proposal.newTagProposals,
      newCategoryProposals: proposal.newCategoryProposals,
    },
    catalogSlugToId,
    payload,
    {
      dryRun: opts.dryRun,
      maxNewTags: opts.maxNewTags,
      applyReclassifications: opts.applyReclassifications,
    }
  );
  if (opts.dryRun) {
    console.log("[DRY-RUN] No DB writes performed.");
  } else {
    console.log(`[APPLIED] ${proposal.listingSlug}`);
  }
  if (typeof payload.db.destroy === "function") await payload.db.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
