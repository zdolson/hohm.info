import { tagCategoryOptions } from "@/collections/Tags";
import type { TagCategoryValue } from "@/collections/Tags";

export const PROMPT_VERSION = "v1";

export interface ExistingTagForPrompt {
  slug: string;
  name: string;
  category: TagCategoryValue;
}

export interface ListingForPrompt {
  slug: string;
  address: string;
  city: string;
  state: string;
  yearBuilt?: number;
  price?: number;
  description?: string;
  property?: { propertyType?: string; status?: string; stories?: number };
  interior?: {
    bedrooms?: number;
    bathroomsFull?: number;
    bathroomsHalf?: number;
    squareFootage?: number;
    fireplaces?: number;
  };
  lot?: { lotSize?: number };
  garageSpaces?: number;
  rawAttributes: string[];
}

export function buildSystemPrompt(opts: {
  existingTags: ExistingTagForPrompt[];
  maxNewTags: number;
}): string {
  const categories = tagCategoryOptions
    .map((o) => `- ${o.value}: ${o.label}`)
    .join("\n");
  const tagList = opts.existingTags
    .map((t) => `- ${t.slug} | ${t.name} (${t.category})`)
    .join("\n");
  return `You are a real estate listing tag inference assistant. Return valid JSON matching the provided schema.

## Tag categories (use only these unless proposing a new category)
${categories}

## Existing tags in catalog (use slugs in existingTagSlugs only; do not invent)
${tagList}

## Rules
1. existingTagSlugs — only slugs from the catalog above.
2. newTagProposals — only when no existing tag covers the concept. The slug field is a suggestion only — the system will validate and may re-derive it from the name. Use lowercase-hyphenated format.
3. newCategoryProposals — ONLY when genuinely distinct from all 12 categories AND ≥2 existing tags would reclassify; include justification and existingTagsToReclassify.
4. Era: Victorian ≤1900, Edwardian 1901–10, Pre-War 1911–45, Post-War 1946–69, Modern 1970–99, Contemporary 2000+.
5. Photo-derived inferences: use confidence "low" when inferred from photo alone.
6. Do not hallucinate; prefer attribute over photo when they conflict.
7. Maximum ${opts.maxNewTags} new tag proposals per listing.`;
}

export function buildUserPrompt(opts: { listing: ListingForPrompt }): string {
  const l = opts.listing;
  const parts: string[] = [
    `Listing: ${l.slug}`,
    `Address: ${l.address}, ${l.city}, ${l.state}`,
  ];
  if (l.yearBuilt !== undefined) parts.push(`Year built: ${l.yearBuilt}`);
  if (l.price !== undefined) parts.push(`Price: ${l.price}`);
  if (l.description) parts.push(`Description: ${l.description}`);
  if (l.property?.propertyType)
    parts.push(`Property type: ${l.property.propertyType}`);
  if (l.property?.status) parts.push(`Status: ${l.property.status}`);
  if (l.property?.stories !== undefined)
    parts.push(`Stories: ${l.property.stories}`);
  if (l.interior?.bedrooms !== undefined)
    parts.push(`Bedrooms: ${l.interior.bedrooms}`);
  if (l.interior?.bathroomsFull !== undefined)
    parts.push(`Bathrooms full: ${l.interior.bathroomsFull}`);
  if (l.interior?.squareFootage !== undefined)
    parts.push(`Square footage: ${l.interior.squareFootage}`);
  if (l.lot?.lotSize !== undefined) parts.push(`Lot size: ${l.lot.lotSize}`);
  if (l.garageSpaces !== undefined)
    parts.push(`Garage spaces: ${l.garageSpaces}`);
  parts.push(`Raw attributes: ${l.rawAttributes.join(", ")}`);
  return parts.join("\n");
}
