/**
 * Gemini-only batch inference. Submits inlined requests to Gemini Batch API (50% cost).
 * Inline batch limit: 20MB total. For larger batches, consider file-based batch (TODO).
 */
import { GoogleGenAI } from "@google/genai";
import type { LLMConfig } from "./types";
import type { InferenceInput, InferenceResult } from "../ai-tag-inference";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { inferenceOutputSchema, inferenceJsonSchema } from "./schema";
import { estimateCost } from "./cost";

const _parsedMaxPhotos = parseInt(process.env.LLM_MAX_PHOTOS ?? "", 10);
const LLM_MAX_PHOTOS = isNaN(_parsedMaxPhotos)
  ? 6
  : Math.max(0, _parsedMaxPhotos);

const POLL_INTERVAL_MS = 30_000;
const MAX_POLL_MS = 24 * 60 * 60 * 1000; // 24h
const INLINE_BATCH_MAX_BYTES = 20 * 1024 * 1024; // 20MB

const TERMINAL_STATES = new Set([
  "JOB_STATE_SUCCEEDED",
  "JOB_STATE_FAILED",
  "JOB_STATE_CANCELLED",
  "JOB_STATE_EXPIRED",
]);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface BatchInferenceItem {
  input: InferenceInput;
  opts: { maxNewTags: number; maxTokens?: number };
}

/** Build one inlined request for the batch API (contents + config with systemInstruction). */
function buildInlinedRequest(item: BatchInferenceItem): {
  contents: unknown;
  config: unknown;
  sizeBytes: number;
} {
  const systemInstruction = buildSystemPrompt({
    existingTags: item.input.existingTags,
    maxNewTags: item.opts.maxNewTags,
  });
  const userText = buildUserPrompt({ listing: item.input.listing });
  const photoBuffers = item.input.photos.slice(0, LLM_MAX_PHOTOS);
  const parts: Array<{
    text?: string;
    inlineData?: { mimeType: string; data: string };
  }> = [{ text: userText }];
  let sizeBytes = userText.length;
  for (const buf of photoBuffers) {
    const b64 = buf.toString("base64");
    sizeBytes += b64.length; // base64-encoded string is the wire payload
    parts.push({
      inlineData: { mimeType: "image/jpeg", data: b64 },
    });
  }
  const contents = [{ role: "user" as const, parts }];
  const config = {
    systemInstruction,
    maxOutputTokens: item.opts.maxTokens ?? 4096,
    responseMimeType: "application/json" as const,
    responseJsonSchema: inferenceJsonSchema,
  };
  return { contents, config, sizeBytes };
}

/**
 * Run tag inference for multiple listings in one Gemini batch job (50% cost).
 * Gemini-only; throws if config.provider !== "gemini".
 * Returns null for individual items that fail (API error, parse, or validation).
 */
export async function inferTagsBatch(
  config: LLMConfig,
  items: BatchInferenceItem[]
): Promise<(InferenceResult | null)[]> {
  if (config.provider !== "gemini") {
    throw new Error(
      `Batch inference is only supported with Gemini. Current provider: ${config.provider}. Use LLM_PROVIDER=gemini.`
    );
  }
  const apiKey =
    config.apiKey ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_AI_API_KEY;
  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error(
      "Gemini batch requires GEMINI_API_KEY or GOOGLE_AI_API_KEY."
    );
  }

  const inlinedRequests: Array<{ contents: unknown; config: unknown }> = [];
  let totalSize = 0;
  for (const item of items) {
    const {
      contents,
      config: reqConfig,
      sizeBytes,
    } = buildInlinedRequest(item);
    totalSize += sizeBytes;
    inlinedRequests.push({ contents, config: reqConfig });
  }
  if (totalSize > INLINE_BATCH_MAX_BYTES) {
    throw new Error(
      `Batch request size (~${(totalSize / 1024 / 1024).toFixed(1)}MB) exceeds Gemini inline batch limit (20MB). Reduce LLM_MAX_PHOTOS or run fewer items per batch.`
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  console.log(
    `[BATCH]   Submitting ${items.length} inlined requests to Gemini batch API...`
  );
  let job = await ai.batches.create({
    model: config.model,
    src: inlinedRequests as import("@google/genai").InlinedRequest[],
    config: { displayName: `hohm-inference-${Date.now()}` },
  });
  if (!job.name) {
    throw new Error("Batch job created but no name returned.");
  }
  const jobName = job.name;
  console.log(`[BATCH]   Job created: ${jobName} (state: ${job.state})`);

  const deadline = Date.now() + MAX_POLL_MS;
  // Loop while state is unknown (undefined) OR not yet terminal
  while (job.state === undefined || !TERMINAL_STATES.has(job.state)) {
    if (Date.now() > deadline) {
      throw new Error(`Batch job timed out: ${jobName}`);
    }
    await sleep(POLL_INTERVAL_MS);
    job = await ai.batches.get({ name: jobName });
    console.log(`[BATCH]   ${jobName} state=${job.state}`);
  }

  if (
    job.state === "JOB_STATE_FAILED" ||
    job.state === "JOB_STATE_CANCELLED" ||
    job.state === "JOB_STATE_EXPIRED"
  ) {
    throw new Error(`Batch job ${job.state}: ${jobName}`);
  }

  const dest = job.dest as
    | {
        inlinedResponses?: Array<{
          response?: {
            text?: string;
            usageMetadata?: {
              promptTokenCount?: number;
              candidatesTokenCount?: number;
            };
            modelVersion?: string;
          };
          error?: { message?: string };
        }>;
      }
    | undefined;
  const responses = dest?.inlinedResponses;
  if (responses === undefined || responses.length !== items.length) {
    throw new Error(
      `Batch job completed but inlinedResponses count (${responses?.length ?? 0}) != input count (${items.length})`
    );
  }

  const results: (InferenceResult | null)[] = [];
  for (let i = 0; i < responses.length; i++) {
    const inlined = responses[i];
    const slug = items[i].input.listing.slug;
    if (inlined.error !== undefined && inlined.error !== null) {
      const msg = inlined.error.message ?? String(inlined.error);
      console.error(`[ERROR]   Batch item ${i} (${slug}) failed: ${msg}`);
      results.push(null);
      continue;
    }
    const res = inlined.response;
    const text = res?.text;
    const content = text !== undefined && text !== null ? String(text) : "";
    const usage = res?.usageMetadata;
    const inputTokens = usage?.promptTokenCount ?? 0;
    const outputTokens = usage?.candidatesTokenCount ?? 0;
    const model = res?.modelVersion ?? config.model;

    let parsed: unknown;
    try {
      parsed = JSON.parse(content) as unknown;
    } catch (parseErr) {
      console.error(
        `[ERROR]   Batch item ${i} (${slug}) invalid JSON: ${(parseErr as Error).message}`
      );
      results.push(null);
      continue;
    }
    let validated;
    try {
      validated = inferenceOutputSchema.parse(parsed);
    } catch (validationErr) {
      console.error(
        `[ERROR]   Batch item ${i} (${slug}) validation failed: ${(validationErr as Error).message}`
      );
      results.push(null);
      continue;
    }
    const cost = estimateCost(
      model,
      { inputTokens, outputTokens },
      { batch: true }
    );
    console.log(
      `[COST]    [batch] ${model} $${cost.toFixed(4)} (${inputTokens} in / ${outputTokens} out) — ${slug}`
    );
    results.push({
      ...validated,
      provider: "gemini",
      model,
      tokenUsage: { inputTokens, outputTokens },
      estimatedCost: cost,
    });
  }
  return results;
}
