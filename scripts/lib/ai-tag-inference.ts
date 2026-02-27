import { createHash } from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import type { TagCategoryValue } from "@/collections/Tags";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { getAddressDebugDir } from "./debug.js";
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

function elapsedMs(start: number): string {
  return `${((Date.now() - start) / 1000).toFixed(1)}s`;
}

export async function inferTags(
  provider: LLMProvider,
  input: InferenceInput,
  opts: { maxNewTags: number; maxTokens?: number; debug?: boolean }
): Promise<InferenceResult> {
  const t0 = Date.now();

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

  console.log(
    `[INFER]   [${elapsedMs(t0)}] Using LLM: ${provider.name} / ${provider.config.model}`
  );

  if (opts.debug === true) {
    try {
      const dir = getAddressDebugDir();
      fs.mkdirSync(dir, { recursive: true });
      const slug = input.listing.slug;
      const photosDir = path.join(dir, "photos");
      fs.mkdirSync(photosDir, { recursive: true });
      const savedPhotos: string[] = [];
      for (let i = 0; i < photoBuffers.length; i++) {
        const name = `photo-${i}.jpg`;
        const photoPath = path.join(photosDir, name);
        fs.writeFileSync(photoPath, photoBuffers[i]);
        savedPhotos.push(name);
      }
      const photoNote =
        savedPhotos.length > 0
          ? `\n# Images: photos/${savedPhotos.join(", photos/")}\n`
          : "";
      const body = `# Inference prompt for ${slug}
# Paste SYSTEM into system prompt (if your client has one), USER into the chat.
# Add the images from photos/ in order if your client supports vision.
# Expected response: JSON with existingTagSlugs, newTagProposals, newCategoryProposals.
${photoNote}

=== SYSTEM ===

${systemPrompt}

=== USER ===

${userText}
`;
      const outPath = path.join(dir, "prompt.txt");
      fs.writeFileSync(outPath, body);
      console.log(`[INFER]   [${elapsedMs(t0)}] Prompt saved to ${outPath}`);
      if (savedPhotos.length > 0) {
        console.log(
          `[INFER]   ${savedPhotos.length} image(s) saved to ${photosDir}`
        );
      }
    } catch {
      // non-fatal
    }
  }

  const tCall = Date.now();
  console.log(
    `[INFER]   [${elapsedMs(t0)}] Calling LLM (${photoBuffers.length} photos, ${input.listing.rawAttributes.length} attributes) — may take 1–2 min...`
  );
  const res = await provider.chat(messages, {
    jsonSchema: inferenceJsonSchema as Record<string, unknown>,
    maxTokens: opts.maxTokens ?? 4096,
  });
  console.log(
    `[INFER]   [${elapsedMs(t0)}] LLM responded (${res.content.length} chars, call=${elapsedMs(tCall)}), parsing...`
  );
  const trimmed = res.content.trim();
  if (trimmed.length === 0) {
    throw new Error(
      "LLM returned empty response. With Ollama, some models do not support structured JSON output and can return nothing. Try a model that supports it (see https://docs.ollama.com/capabilities/structured-outputs) or run with --skip-inference."
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(res.content) as unknown;
  } catch (parseErr) {
    const snippet = trimmed.slice(0, 200);
    throw new Error(
      `LLM response was not valid JSON: ${(parseErr as Error).message}. First 200 chars: ${snippet}`
    );
  }
  const validated = inferenceOutputSchema.parse(parsed);
  console.log(`[INFER]   [${elapsedMs(t0)}] Done`);
  return {
    ...validated,
    provider: provider.name,
    model: res.model,
    tokenUsage: res.tokenUsage,
  };
}
