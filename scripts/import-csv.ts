/**
 * Import tags and/or listings from CSV files.
 * Run: pnpm import-csv --tags <file> [--listings <file>] [--dry-run]
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
import { parseTagsCsv } from "./lib/parse-tags-csv";
import { parseListingsCsv } from "./lib/parse-listings-csv";

function parseArgs() {
  const args = process.argv.slice(2);
  const result: { tags?: string; listings?: string; dryRun: boolean } = {
    dryRun: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tags") result.tags = args[++i];
    else if (args[i] === "--listings") result.listings = args[++i];
    else if (args[i] === "--dry-run") result.dryRun = true;
  }
  return result;
}

async function main() {
  const args = parseArgs();
  if (!args.tags && !args.listings) {
    console.error(
      "Usage: pnpm import-csv [--tags <file>] [--listings <file>] [--dry-run]"
    );
    process.exit(1);
  }

  const payload = await getPayload({ config });
  let hadError = false;

  const tagStats = { created: 0, skipped: 0, errors: 0 };
  const listingStats = { created: 0, skipped: 0, errors: 0 };

  // slug -> id cache (populated from tag import + DB lookups)
  const tagSlugToId: Record<string, number> = {};

  try {
    // ── Tags ─────────────────────────────────────────────────────────────
    if (args.tags) {
      const csv = readFileSync(args.tags, "utf-8");
      const { ok, errors } = parseTagsCsv(csv);
      const file = path.basename(args.tags);

      for (const e of errors) {
        for (const msg of e.messages) {
          console.log(`[ERROR]   Row ${e.index} (${file}): ${msg}`);
        }
        tagStats.errors++;
        hadError = true;
      }

      for (const tag of ok) {
        const existing = await payload.find({
          collection: "tags",
          where: { slug: { equals: tag.slug } },
          limit: 1,
        });

        if (existing.docs.length > 0) {
          tagSlugToId[tag.slug] = existing.docs[0].id as number;
          console.log(`[SKIP]    Tag: ${tag.slug} (already exists)`);
          tagStats.skipped++;
          continue;
        }

        if (args.dryRun) {
          console.log(
            `[DRY-RUN] Would create tag: ${tag.slug} (${tag.category})`
          );
          tagStats.created++;
          continue;
        }

        try {
          const doc = await payload.create({
            collection: "tags",
            data: {
              name: tag.name,
              slug: tag.slug,
              category: tag.category,
              description: tag.description,
              resources: tag.resources,
            },
            overrideAccess: true,
          });
          tagSlugToId[tag.slug] = doc.id as number;
          console.log(`[CREATED] Tag: ${tag.slug} (${tag.category})`);
          tagStats.created++;
        } catch (err) {
          console.log(`[ERROR]   Tag ${tag.slug}: ${(err as Error).message}`);
          tagStats.errors++;
          hadError = true;
        }
      }
    }

    // ── Listings ──────────────────────────────────────────────────────────
    if (args.listings) {
      const csv = readFileSync(args.listings, "utf-8");
      const { ok, errors } = parseListingsCsv(csv);
      const file = path.basename(args.listings);

      for (const e of errors) {
        for (const msg of e.messages) {
          console.log(`[ERROR]   Row ${e.index} (${file}): ${msg}`);
        }
        listingStats.errors++;
        hadError = true;
      }

      for (const listing of ok) {
        const existing = await payload.find({
          collection: "listings",
          where: { slug: { equals: listing.slug } },
          limit: 1,
        });

        if (existing.docs.length > 0) {
          console.log(`[SKIP]    Listing: ${listing.slug} (already exists)`);
          listingStats.skipped++;
          continue;
        }

        // Resolve tag slugs → IDs
        const resolvedTagIds: number[] = [];
        for (const tagSlug of listing.tags ?? []) {
          if (tagSlugToId[tagSlug] !== undefined) {
            resolvedTagIds.push(tagSlugToId[tagSlug]);
          } else {
            const found = await payload.find({
              collection: "tags",
              where: { slug: { equals: tagSlug } },
              limit: 1,
            });
            if (found.docs.length > 0) {
              const id = found.docs[0].id as number;
              tagSlugToId[tagSlug] = id;
              resolvedTagIds.push(id);
            } else {
              console.log(
                `[WARN]    Listing ${listing.slug}: tag slug "${tagSlug}" not found — skipping tag`
              );
            }
          }
        }

        if (args.dryRun) {
          console.log(`[DRY-RUN] Would create listing: ${listing.slug}`);
          listingStats.created++;
          continue;
        }

        try {
          await payload.create({
            collection: "listings",
            data: {
              ...listing,
              title: listing.title || listing.address,
              tags: resolvedTagIds,
            },
            overrideAccess: true,
          });
          console.log(`[CREATED] Listing: ${listing.slug}`);
          listingStats.created++;
        } catch (err) {
          console.log(
            `[ERROR]   Listing ${listing.slug}: ${(err as Error).message}`
          );
          listingStats.errors++;
          hadError = true;
        }
      }
    }

    // ── Summary ───────────────────────────────────────────────────────────
    const parts: string[] = [];
    if (args.tags) {
      parts.push(
        `${tagStats.created} tags created (${tagStats.skipped} skipped, ${tagStats.errors} errors)`
      );
    }
    if (args.listings) {
      parts.push(
        `${listingStats.created} listings created (${listingStats.skipped} skipped, ${listingStats.errors} errors)`
      );
    }
    console.log(`\nSummary: ${parts.join(" | ")}`);
  } finally {
    if (typeof payload.db.destroy === "function") await payload.db.destroy();
  }

  if (hadError) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
