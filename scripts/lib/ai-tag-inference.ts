import { createHash } from "crypto";
import type { TagCategoryValue } from "@/collections/Tags";
import type { LLMProvider } from "./llm/types";
import {
  buildSystemPrompt,
  buildUserPrompt,
  PROMPT_VERSION,
} from "./llm/prompt";
import {
  inferenceOutputSchema,
  inferenceJsonSchema,
  type InferenceOutput,
} from "./llm/schema";

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

export interface InferenceResult extends InferenceOutput {
  provider: string;
  model: string;
  tokenUsage: { inputTokens: number; outputTokens: number };
}

const LLM_MAX_PHOTOS = Math.max(
  0,
  parseInt(process.env.LLM_MAX_PHOTOS ?? "6", 10) || 6
);

export async function inferTags(
  provider: LLMProvider,
  input: InferenceInput,
  opts: { maxNewTags: number; maxTokens?: number }
): Promise<InferenceResult> {
  const systemPrompt = buildSystemPrompt({
    existingTags: input.existingTags,
    maxNewTags: opts.maxNewTags,
  });
  const userText = buildUserPrompt({ listing: input.listing });
  const photoBuffers = input.photos.slice(0, LLM_MAX_PHOTOS);
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: Buffer; mimeType: string }
  > = [{ type: "text", text: userText }];
  for (const buf of photoBuffers) {
    content.push({ type: "image", data: buf, mimeType: "image/jpeg" });
  }
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: content.length > 1 ? content : userText },
  ];
  const res = await provider.chat(messages, {
    jsonSchema: inferenceJsonSchema as Record<string, unknown>,
    maxTokens: opts.maxTokens ?? 4096,
  });
  const parsed = JSON.parse(res.content) as unknown;
  const validated = inferenceOutputSchema.parse(parsed);
  return {
    ...validated,
    provider: provider.name,
    model: res.model,
    tokenUsage: res.tokenUsage,
  };
}
