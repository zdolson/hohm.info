import type { Payload } from "payload";
import { isValidSlug } from "@/lib/validate";
import type { InferenceOutput } from "./llm/schema";
import type { TagCategoryValue } from "@/collections/Tags";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function applyProposal(
  listingId: number,
  currentTagIds: number[],
  result: InferenceOutput,
  catalogSlugToId: Map<string, number>,
  payload: Payload,
  opts: {
    dryRun: boolean;
    maxNewTags: number;
    applyReclassifications?: boolean;
  }
): Promise<void> {
  const resolvedIds: number[] = [];
  for (const slug of result.existingTagSlugs) {
    const id = catalogSlugToId.get(slug);
    if (id !== undefined) {
      resolvedIds.push(id);
    } else {
      console.warn(`[WARN] Unknown catalog slug in proposal: ${slug}`);
    }
  }

  let created = 0;
  for (const prop of result.newTagProposals) {
    if (created >= opts.maxNewTags) {
      console.log(
        `[LIMIT] Max new tags reached (${opts.maxNewTags}), skipping remaining`
      );
      break;
    }
    const candidateSlug = isValidSlug(prop.slug)
      ? prop.slug
      : slugify(prop.name);
    if (!isValidSlug(candidateSlug)) {
      console.warn(`[WARN] Invalid slug derived for "${prop.name}", skipping`);
      continue;
    }
    const existingId = catalogSlugToId.get(candidateSlug);
    if (existingId !== undefined) {
      console.log(`[EXISTING TAG] ${candidateSlug}`);
      resolvedIds.push(existingId);
      continue;
    }
    if (opts.dryRun) {
      console.log(
        `[DRY-RUN] Would create tag: ${candidateSlug} (${prop.category})`
      );
      continue;
    }
    try {
      const doc = await payload.create({
        collection: "tags",
        data: {
          name: prop.name,
          slug: candidateSlug,
          category: prop.category as TagCategoryValue,
          description: prop.description,
        },
        overrideAccess: true,
      });
      const actualSlug = (doc as unknown as { slug: string }).slug;
      const id = doc.id as number;
      catalogSlugToId.set(actualSlug, id);
      resolvedIds.push(id);
      created++;
      console.log(`[CREATED TAG] ${actualSlug} (${prop.category})`);
    } catch (err) {
      console.warn(
        `[WARN] Could not create tag ${candidateSlug}: ${(err as Error).message}`
      );
    }
  }

  if (result.newCategoryProposals.length > 0) {
    console.warn(
      "[WARN] New categories require updating Tags.ts enum + pnpm generate:types — manual step"
    );
    for (const cat of result.newCategoryProposals) {
      console.warn(
        `  Reclassify: ${cat.existingTagsToReclassify.join(", ")} -> ${cat.slug}`
      );
    }
    if (opts.applyReclassifications === true) {
      for (const cat of result.newCategoryProposals) {
        for (const tagSlug of cat.existingTagsToReclassify) {
          const existing = await payload.find({
            collection: "tags",
            where: { slug: { equals: tagSlug } },
            limit: 1,
          });
          if (existing.docs.length > 0) {
            await payload.update({
              collection: "tags",
              id: existing.docs[0].id,
              data: { category: cat.slug as TagCategoryValue },
              overrideAccess: true,
            });
            console.log(`[RECLASSIFIED] ${tagSlug} -> ${cat.slug}`);
          } else {
            console.warn(`[WARN] Reclassification slug not found: ${tagSlug}`);
          }
        }
      }
    }
  }

  const merged = [...new Set([...currentTagIds, ...resolvedIds])];
  if (opts.dryRun) {
    console.log("[DRY-RUN] Would update listing tags to:", merged);
    return;
  }
  await payload.update({
    collection: "listings",
    id: listingId,
    data: { tags: merged },
    overrideAccess: true,
  });
}
