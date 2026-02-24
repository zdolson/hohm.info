import { createHash } from "crypto";
import type { TagCategoryValue } from "@/collections/Tags";

export interface InferenceInput {
  listing: {
    slug: string;
    address: string;
    city: string;
    state: string;
    yearBuilt?: number;
    price?: number;
    description?: string;
    property?: {
      propertyType?: string;
      status?: string;
      stories?: number;
    };
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
  };
  photos: Buffer[];
  existingTags: Array<{
    slug: string;
    name: string;
    category: TagCategoryValue;
    description?: string;
  }>;
}

/** SHA-256 of normalized inference input for idempotency. */
export function computeInputFingerprint(
  input: InferenceInput,
  provider: string,
  model: string,
  promptVersion: string
): string {
  const listing = input.listing;
  const normalized = [
    provider,
    model,
    promptVersion,
    listing.slug,
    listing.address,
    listing.city,
    listing.state,
    String(listing.yearBuilt ?? ""),
    String(listing.price ?? ""),
    listing.description ?? "",
    listing.property?.propertyType ?? "",
    listing.property?.status ?? "",
    String(listing.property?.stories ?? ""),
    String(listing.interior?.bedrooms ?? ""),
    String(listing.interior?.bathroomsFull ?? ""),
    String(listing.interior?.squareFootage ?? ""),
    String(listing.lot?.lotSize ?? ""),
    String(listing.garageSpaces ?? ""),
    [...listing.rawAttributes].sort().join(","),
    ...input.photos.map((b) => createHash("sha256").update(b).digest("hex")),
  ].join("|");
  return createHash("sha256").update(normalized).digest("hex");
}
