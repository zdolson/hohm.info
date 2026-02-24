---
name: ""
overview: ""
todos: []
isProject: false
---

# AI Tag Inference Pipeline

## Context

Current `infer-tags.ts` does naive string-matching on 33 hardcoded keyword→slug pairs from Zillow's raw attribute fields. This misses tags not surfaced as structured attributes (visual features in photos, contextual inference from year/location/price, novel features with no existing tag). Goal: LLM-powered inference layer that:

- Analyzes all listing fields + stored listing photos (vision)
- Matches existing DB tags and proposes new ones
- Stays constrained to 12 categories by default; can propose a new category only when genuinely warranted + would reclassify existing tags
- **Local-first** — Ollama as primary LLM provider; provider-abstracted for future model comparison (Gemini Flash, OpenAI, etc.)
- **Photos owned** — downloads listing photos during data acquisition, uploads to media collection; serves to LLM from our storage
- **Storage-backed source of truth** — inference reads listing photos from Payload media (Supabase storage/S3-compatible), never directly from Zillow URLs
- Defaults to a human-review JSON file; `--auto-approve-tags` skips review
- All LLM output validated via Zod before DB writes
- **Idempotent by default** — same normalized input does not generate new proposal/tags unless `--force-revalidate` is set
- Runs standalone (`enrich-listing`) or inline during `import-address`

---

## New Files


| File                              | Purpose                                                                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `scripts/lib/llm/types.ts`        | `LLMProvider` interface, `LLMConfig`, message types                                                                     |
| `scripts/lib/llm/ollama.ts`       | Ollama provider via OpenAI-compatible SDK                                                                               |
| `scripts/lib/llm/config.ts`       | Provider factory — reads env, returns `LLMProvider`                                                                     |
| `scripts/lib/llm/prompt.ts`       | System + user prompt builders (model-agnostic)                                                                          |
| `scripts/lib/llm/schema.ts`       | Zod schemas for inference output + `zodToJsonSchema` bridge                                                             |
| `scripts/lib/ai-tag-inference.ts` | Orchestrator: builds input, calls provider, validates output                                                            |
| `scripts/lib/apply-proposal.ts`   | Shared helper — create tags + update listing                                                                            |
| `scripts/lib/media-bytes.ts`      | Read media file bytes from Payload storage (local fs or Supabase URL/signed URL)                                        |
| `scripts/lib/download-photos.ts`  | Download external photo URLs → resize via sharp → upload to Payload media                                               |
| `scripts/enrich-listing.ts`       | Standalone CLI: `--slug`/`--all`, `--force`, `--force-revalidate`, `--auto-approve-tags`, `--dry-run`, `--max-new-tags` |
| `scripts/apply-tags.ts`           | Apply a saved proposal JSON to DB; optionally apply category reclassifications after taxonomy update                    |
| `scripts/output/.gitkeep`         | Ensure output dir exists in repo                                                                                        |


## Modified Files


| File                             | Change                                                                                                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/collections/Tags.ts`        | Export `tagCategoryOptions as const`; derive `TagCategoryValue` union                                                                                                       |
| `scripts/lib/fetcher.ts`         | Add `photoUrls?: string[]`, `description?: string` to `ScrapedProperty`                                                                                                     |
| `scripts/lib/fetchers/zillow.ts` | Add `extractPhotoUrls(data)` + `extractDescription(data)` helpers; populate in `mapZillowResult`                                                                            |
| `scripts/import-address.ts`      | Add photo download/upload step, `--auto-approve-tags`, `--max-new-tags`, `--skip-inference`, `--skip-photos`, `--force-revalidate`; add AI inference after listing creation |
| `package.json`                   | Add `enrich-listing` + `apply-tags` scripts; add `openai`, `zod`, `zod-to-json-schema` deps                                                                                 |
| `.env.example`                   | Add `LLM_`* placeholders                                                                                                                                                    |
| `.gitignore`                     | Ignore `scripts/output/tag-proposals/*.json`                                                                                                                                |


---

## Tag Category Extraction (`src/collections/Tags.ts`)

Export category options as `as const` — single source of truth for category values:

```ts
export const tagCategoryOptions = [
  { label: "Style", value: "style" },
  { label: "Exterior", value: "exterior" },
  { label: "Roofing", value: "roofing" },
  { label: "Structure", value: "structure" },
  { label: "Systems", value: "systems" },
  { label: "Utilities", value: "utilities" },
  { label: "Interior", value: "interior" },
  { label: "Parking", value: "parking" },
  { label: "Features", value: "features" },
  { label: "Hazards", value: "hazards" },
  { label: "Era", value: "era" },
  { label: "Region", value: "region" },
] as const;

export type TagCategoryValue = (typeof tagCategoryOptions)[number]["value"];
```

Collection definition uses `options: [...tagCategoryOptions]`. All other files import `TagCategoryValue` — no redeclaring the union.

---

## Key Interfaces (`scripts/lib/ai-tag-inference.ts`)

```ts
import type { TagCategoryValue } from "../../src/collections/Tags";

export interface InferenceInput {
  listing: {
    slug: string; address: string; city: string; state: string;
    yearBuilt?: number; price?: number; description?: string;
    property?: { propertyType?: string; status?: string; stories?: number };
    interior?: { bedrooms?: number; bathroomsFull?: number; bathroomsHalf?: number;
                 squareFootage?: number; fireplaces?: number };
    lot?: { lotSize?: number };
    garageSpaces?: number;
    rawAttributes: string[];
  };
  photos: Buffer[];                    // JPEG buffers from media storage; base64-encoded before sending to LLM
  existingTags: Array<{               // full DB catalog — LLM prefers matching these
    slug: string; name: string; category: TagCategoryValue; description?: string;
  }>;
}

export interface NewTagProposal {
  name: string; slug: string; category: TagCategoryValue;
  description: string;                // 1–2 sentences
  confidence: "high" | "medium" | "low";
  rationale: string;                  // cite evidence (attribute string or photo observation)
}

export interface NewCategoryProposal {
  name: string; slug: string;
  justification: string;
  existingTagsToReclassify: string[];
}

export interface InferenceResult {
  existingTagSlugs: string[];
  newTagProposals: NewTagProposal[];
  newCategoryProposals: NewCategoryProposal[];  // nearly always []
  provider: string;
  model: string;
  tokenUsage: { inputTokens: number; outputTokens: number };
}
```

---

## LLM Provider Abstraction

### `scripts/lib/llm/types.ts`

```ts
export interface LLMConfig {
  provider: "ollama" | "openai" | "gemini";
  model: string;
  visionModel?: string;       // defaults to model; set separately for two-pass inference
  baseUrl: string;
  apiKey?: string;             // not needed for local Ollama
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string | LLMContentBlock[];
}

export type LLMContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: Buffer; mimeType: string };

export interface LLMResponse {
  content: string;             // raw JSON string from structured output
  model: string;
  tokenUsage: { inputTokens: number; outputTokens: number };
}

export interface LLMProvider {
  readonly name: string;
  readonly config: LLMConfig;
  readonly supportsVision: boolean;
  chat(messages: LLMMessage[], options?: {
    jsonSchema?: Record<string, unknown>;
    maxTokens?: number;
  }): Promise<LLMResponse>;
}
```

### `scripts/lib/llm/ollama.ts`

Uses `openai` SDK with `baseURL` pointed at Ollama's OpenAI-compatible endpoint (`/v1`).

- Converts `LLMContentBlock[]` → OpenAI message format (base64 data URIs for images)
- Passes `response_format: { type: "json_schema", json_schema: { name: "inference", schema } }` for structured output
- Detects vision support by checking if the configured model supports images (vision model set)
- **Two-pass mode** when `visionModel !== model`:
  1. Vision model: "Describe exterior materials, roof type, garage, yard features, and any notable architectural details visible in these photos." → text descriptions
  2. Text model: full tag inference prompt with photo descriptions injected as text under a "Photo observations" section
- **Single-pass mode** when `visionModel === model` (default): images + text sent together

### `scripts/lib/llm/config.ts`

```ts
export function createProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER ?? "ollama";
  const model = process.env.LLM_MODEL ?? "llama3.2-vision";
  const visionModel = process.env.LLM_VISION_MODEL ?? model;
  const baseUrl = process.env.LLM_BASE_URL ?? "http://localhost:11434/v1";
  const apiKey = process.env.LLM_API_KEY;

  switch (provider) {
    case "ollama":
      return new OllamaProvider({ provider: "ollama", model, visionModel, baseUrl, apiKey });
    // Future: case "gemini": ...
    // Future: case "openai": ...
    default:
      throw new Error(`Unknown LLM_PROVIDER: ${provider}`);
  }
}

/** Returns true if LLM env vars are configured. Used to skip inference gracefully. */
export function isLLMConfigured(): boolean {
  return process.env.LLM_PROVIDER !== undefined
    || process.env.LLM_MODEL !== undefined;
}
```

---

## Validation (`scripts/lib/llm/schema.ts`)

Zod schemas validate **all** LLM output before any DB writes. JSON schema derived for the LLM's `response_format` parameter.

```ts
import { z } from "zod";
import { tagCategoryOptions } from "../../../src/collections/Tags";
import { zodToJsonSchema } from "zod-to-json-schema";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const categoryValues = tagCategoryOptions.map((o) => o.value);

const newTagProposalSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(SLUG_RE),
  category: z.enum(categoryValues as [string, ...string[]]),
  description: z.string().min(1).max(500),
  confidence: z.enum(["high", "medium", "low"]),
  rationale: z.string().min(1).max(500),
});

const newCategoryProposalSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(SLUG_RE),
  justification: z.string().min(1).max(500),
  existingTagsToReclassify: z.array(z.string().regex(SLUG_RE)),
});

export const inferenceOutputSchema = z.object({
  existingTagSlugs: z.array(z.string().regex(SLUG_RE)),
  newTagProposals: z.array(newTagProposalSchema),
  newCategoryProposals: z.array(newCategoryProposalSchema),
});

export type InferenceOutput = z.infer<typeof inferenceOutputSchema>;

export const inferenceJsonSchema = zodToJsonSchema(inferenceOutputSchema, "InferenceOutput");
```

The JSON schema is passed to the LLM's structured output parameter. The Zod schema validates the parsed response. Both enforce the same contract — eliminates regex-based JSON extraction entirely.

### Proposal file schema (for `apply-tags.ts`)

```ts
export const proposalFileSchema = z.object({
  listingSlug: z.string().regex(SLUG_RE),
  generatedAt: z.string(),
  provider: z.string(),
  model: z.string(),
  inputFingerprint: z.string().min(1),
  promptVersion: z.string().min(1),
  tokenUsage: z.object({ inputTokens: z.number(), outputTokens: z.number() }),
  photosAnalyzed: z.number().int().min(0),
  existingTagSlugs: z.array(z.string().regex(SLUG_RE)),
  newTagProposals: z.array(newTagProposalSchema),
  newCategoryProposals: z.array(newCategoryProposalSchema),
});
```

Rejects malformed or tampered proposal files with descriptive Zod errors.

`inputFingerprint` is SHA-256 of normalized inference input (listing fields used in prompt, sorted `rawAttributes`, photo content hashes, provider/model, prompt version). If fingerprint matches a prior run and `--force-revalidate` is not set, skip inference and reuse existing proposal/tags state.

---

## Photo Acquisition (`scripts/lib/download-photos.ts`)

```ts
export interface DownloadedPhoto {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

export async function downloadPhotos(
  urls: string[],
  opts?: { maxPhotos?: number },
): Promise<DownloadedPhoto[]>

export async function uploadPhotosToMedia(
  photos: DownloadedPhoto[],
  payload: Payload,
  listingSlug: string,
): Promise<number[]>  // media doc IDs
```

### `downloadPhotos` (ingest-only from source feeds)

- Validates each URL with `safeUrl` pattern (`https://` required)
- Domain allowlist (enforced): default `zillowstatic.com`, `photos.zillowstatic.com`; untrusted host skipped with `[WARN]`
- 10s timeout per image via `AbortController`
- Skips failures with `[WARN]` log (non-blocking)
- Resizes via `sharp` to max 1024px longest side, JPEG 80% quality (saves storage + LLM context)
- Returns `slice(0, maxPhotos ?? 6)`

### `uploadPhotosToMedia`

- `payload.create({ collection: "media", data: { alt: "Listing photo — {slug} — {index}" }, file: { data, mimetype, name, size }, overrideAccess: true })`
- Returns array of created media doc IDs
- Logs `[UPLOADED]` per photo

### Reading photos back (for `enrich-listing` + `import-address` inference)

Existing listings have photos in the media collection. To prepare `Buffer[]` for LLM inference:

1. Load listing with `depth: 1` on `photos` → full media documents
2. Resolve bytes via `readMediaBytes(mediaDoc, payload)`:
  - Local adapter: read from upload dir path
  - Supabase/S3-compatible adapter: fetch from media URL (or signed URL if private)
3. Enforce media origin allowlist (`MEDIA_STORAGE_ORIGINS`) before remote fetch
4. Return as `Buffer[]`

Inference always uses stored media bytes; external feed URLs are never sent to LLM.

---

## Prompt Strategy (model-agnostic)

Prompts live in `scripts/lib/llm/prompt.ts`. Model-agnostic — same prompts regardless of provider.

**System prompt** (static template, injected with runtime data):

- Full 12-category taxonomy with examples per category (derived from `tagCategoryOptions`)
- Existing DB tags rendered as readable list (slug + name + category), injected at call time
- Rules:
  1. Return valid JSON matching the provided schema
  2. `existingTagSlugs` — slugs from DB catalog only (no invention here)
  3. `newTagProposals` — only when no existing tag covers the concept; kebab-case slug
  4. Era inference from `yearBuilt` (Victorian ≤1900, Edwardian 1901–10, Pre-War 1911–45, Post-War 1946–69, Modern 1970–99, Contemporary 2000+)
  5. `newCategoryProposals` — ONLY when genuinely distinct from all 12 AND ≥2 existing tags would reclassify; must provide justification + `existingTagsToReclassify` list
  6. Photo guidance: identify exterior material, roof, garage, deck/pool/porch; mark `confidence: "low"` if inferred from photo alone
  7. Do not hallucinate; when attribute + photo conflict, prefer attribute
  8. Max `{maxNewTags}` new tag proposals per listing

**User message**: Structured text block (all listing fields) + base64 image content blocks (if vision model)

**JSON extraction**: Structured output via `response_format` — LLM constrained to valid JSON matching `inferenceJsonSchema`. No regex parsing. Zod validates the parsed result as a second safety layer.

---

## Proposal File Schema (`scripts/output/tag-proposals/{slug}.json`)

```json
{
  "listingSlug": "2115-anderson-dr-se-east-grand-rapids",
  "generatedAt": "2026-02-23T14:32:00.000Z",
  "provider": "ollama",
  "model": "llama3.2-vision:11b",
  "inputFingerprint": "5f9a1f2f...d5f2",
  "promptVersion": "v1",
  "tokenUsage": { "inputTokens": 1842, "outputTokens": 318 },
  "photosAnalyzed": 4,
  "existingTagSlugs": ["ranch", "brick-exterior", "post-war"],
  "newTagProposals": [
    {
      "name": "Copper Plumbing",
      "slug": "copper-plumbing",
      "category": "utilities",
      "description": "Copper supply lines; durable but check solder joints in pre-1986 homes for lead.",
      "confidence": "medium",
      "rationale": "Attribute string 'Copper' in plumbing field."
    }
  ],
  "newCategoryProposals": []
}
```

Human edits the file before running `apply-tags`. File is self-contained (no re-inference needed). Validated by `proposalFileSchema` on load.

---

## `scripts/lib/apply-proposal.ts` (shared helper)

Used by `enrich-listing.ts`, `import-address.ts`, and `apply-tags.ts`.

```ts
export async function applyProposal(
  listingId: number,
  currentTagIds: number[],
  result: InferenceOutput,          // Zod-validated
  catalogSlugToId: Map<string, number>,
  payload: Payload,
  opts: { dryRun: boolean; maxNewTags: number; applyReclassifications?: boolean },
): Promise<void>
```

Steps:

1. Resolve `existingTagSlugs` → IDs via `catalogSlugToId` map; log `[WARN]` + skip for any slug not in catalog
2. Validate + upsert each `newTagProposals` item (idempotent by slug):
  - Re-validate slug format (`isValidSlug` from `@/lib/validate`)
  - Verify category is valid enum value
  - Enforce `maxNewTags` limit; skip remainder with `[LIMIT] Max new tags reached (N), skipping M remaining` log
  - If `catalogSlugToId` already has slug: reuse existing ID; log `[EXISTING TAG] {slug}`
  - Else create via `payload.create(...)`; add ID to map; log `[CREATED TAG] {slug} ({category})`
3. For `newCategoryProposals`:
  - Default: log warning ("new categories require updating Tags.ts enum + `pnpm generate:types` — manual step"); list tags to reclassify; skip writes
  - If `opts.applyReclassifications === true`: for each `existingTagsToReclassify`, load by slug and update `category` to new category slug; log `[RECLASSIFIED] {slug} -> {category}`
  - Unknown reclassification slug: log `[WARN]` and continue
4. Union `currentTagIds + resolved + new IDs`, deduplicate
5. `payload.update({ collection: "listings", id, data: { tags: mergedIds }, overrideAccess: true })`
6. With `--dry-run`: log all actions, skip writes

---

## `scripts/lib/fetchers/zillow.ts` — Photo + Description Extraction

### `extractPhotoUrls(data: unknown): string[]`

Tries 5 shapes in priority order:

1. `data.photos[].url` (string) or `data.photos[]` (string)
2. `data.carouselPhotos[].url` or `.mixedSources.jpeg[0].url`
3. `data.images[]` (string or `.url`)
4. `data.hiResPicture` (single string)
5. `data.miniCardPhotos[].url`

Dedup + return `slice(0, 20)` (download step handles final photo limit + resize).

### `extractDescription(data: unknown): string | undefined`

Tries: `data.description`, `data.homeDescription`, `data.Description`. Returns trimmed string or `undefined`.

Add to `mapZillowResult` return:

- `photoUrls: extractPhotoUrls(data)`
- `description: extractDescription(data)`

---

## `scripts/enrich-listing.ts` Flow

```
parseArgs(--slug, --all, --force, --force-revalidate, --auto-approve-tags, --dry-run, --max-new-tags, --no-tag-limit)
→ createProvider()
→ getPayload → load listing(s) → load full tag catalog
For each listing:
  → skip if tags.length > 0 && !--force  [SKIP]
  → load listing photos from media storage (depth: 1 → filename → read from disk → Buffer[])
  → build normalized inference fingerprint (input + model/provider + promptVersion)
  → if existing proposal fingerprint matches && !--force-revalidate: [SKIP] revalidation not forced
  → build InferenceInput
  → inferTags(provider, input) → Zod-validated InferenceResult
  → log [TOKENS] input=N output=N model=M provider=P
  → without --auto-approve-tags:
      mkdirSync(scripts/output/tag-proposals, {recursive:true})
      write {slug}.json → print [PROPOSAL] path + apply-tags instruction
  → with --auto-approve-tags:
      applyProposal() → [CREATED TAG] / [APPLIED] / [DRY-RUN] logs
→ payload.db.destroy()
```

`--all` processes sequentially (respects local LLM throughput).

---

## `scripts/import-address.ts` Integration

After step 7 (listing created), adds:

### Step 8 — Photo acquisition

```
→ downloadPhotos(scraped.photoUrls)            // buffers in memory
→ uploadPhotosToMedia(photos, payload, slug)   // → mediaIds
→ payload.update({ collection: "listings", id, data: { photos: mediaIds }, overrideAccess: true })
→ log [PHOTOS] Uploaded N photo(s) for {slug}
```

Skipped with `--skip-photos`. Photos download even when `--skip-inference` is set.

### Step 9 — AI tag inference

```
→ skip if !isLLMConfigured()  [SKIP] LLM not configured
→ load full tag catalog from DB
→ build InferenceInput with photo buffers read from listing media storage
→ inferTags(provider, input) → Zod-validated
→ log [TOKENS]
→ without --auto-approve-tags: write proposal JSON + print instruction
→ with --auto-approve-tags: applyProposal() → union(stringMatch + AI)
```

Skipped with `--skip-inference`. String-match tags (steps 3–4) and AI tags are merged (union) — no double-counting.

Idempotency:

- Build same normalized inference fingerprint used by `enrich-listing`
- If fingerprint unchanged and `--force-revalidate` not set, skip inference/proposal write
- With `--force-revalidate`, always call LLM and overwrite proposal metadata

---

## `scripts/apply-tags.ts` Flow

```
read + parse <file>
→ validate against proposalFileSchema (Zod) — rejects malformed/tampered files with descriptive errors
→ getPayload → find listing by slug
→ load tag catalog for slug resolution
→ applyProposal() with dryRun + maxNewTags (+ optional applyReclassifications) flags
→ payload.db.destroy()
```

When proposal contains `newCategoryProposals`, operator flow:

1. Update `tagCategoryOptions` in `src/collections/Tags.ts`
2. Run `pnpm generate:types`
3. Run `pnpm apply-tags <file> --apply-reclassifications` to execute reclassification list from proposal

---

## New Category Handling

Since `category` is a Payload `select` field enum in `src/collections/Tags.ts` (sourced from `tagCategoryOptions`), new categories **cannot be added programmatically** — they require a code change + regenerating types. When `newCategoryProposals` is non-empty:

- Log clear warning with justification + reclassification list
- Do NOT create tags under the new category (would fail Payload validation)
- Post-review executable path: after adding category + generating types, run `apply-tags --apply-reclassifications` to update categories for listed existing tags

---

## Configuration

### Environment Variables (`.env.example`)

```
# LLM — local-first via Ollama
LLM_PROVIDER=ollama
LLM_MODEL=llama3.2-vision
# LLM_VISION_MODEL=                     # optional; defaults to LLM_MODEL. Set for two-pass inference.
LLM_BASE_URL=http://localhost:11434/v1   # supports remote Ollama instances on LAN
# LLM_API_KEY=                           # not needed for local Ollama

# Inference defaults
LLM_MAX_NEW_TAGS=30                      # per-listing limit; override via --max-new-tags CLI
LLM_MAX_PHOTOS=6                         # max photos sent to LLM per listing

# Photo ingest trust boundary (source feed)
PHOTO_SOURCE_ALLOWLIST=zillowstatic.com,photos.zillowstatic.com

# Media read trust boundary (our storage; varies by env)
# local Supabase example: http://127.0.0.1:54321/storage/v1/object/public
# prod Supabase example: https://<project-ref>.supabase.co/storage/v1/object/public
MEDIA_STORAGE_ORIGINS=http://127.0.0.1:54321,https://<project-ref>.supabase.co
```

### CLI Flags


| Flag                        | Script(s)                                  | Default                               |
| --------------------------- | ------------------------------------------ | ------------------------------------- |
| `--auto-approve-tags`       | enrich-listing, import-address             | off (write proposal)                  |
| `--max-new-tags N`          | enrich-listing, import-address, apply-tags | `LLM_MAX_NEW_TAGS` or 30              |
| `--no-tag-limit`            | enrich-listing, import-address, apply-tags | off (limit enforced)                  |
| `--force`                   | enrich-listing                             | off (skip if has tags)                |
| `--force-revalidate`        | enrich-listing, import-address             | off (skip when fingerprint unchanged) |
| `--apply-reclassifications` | apply-tags                                 | off (warn + skip category proposals)  |
| `--dry-run`                 | all three                                  | off                                   |
| `--skip-inference`          | import-address                             | off                                   |
| `--skip-photos`             | import-address                             | off                                   |


### Ollama Model Recommendations


| Use Case                 | Model                 | Size | VRAM  | Notes                                               |
| ------------------------ | --------------------- | ---- | ----- | --------------------------------------------------- |
| Multimodal (text+vision) | `llama3.2-vision:11b` | 11B  | ~8GB  | Best balance; single-pass inference                 |
| Text-only (fast)         | `qwen2.5:7b`          | 7B   | ~5GB  | Good JSON structured output; pair with vision model |
| Text-only (quality)      | `deepseek-r1:14b`     | 14B  | ~10GB | Better reasoning; slower                            |
| Vision-only (split mode) | `llava:7b`            | 7B   | ~5GB  | Lightweight; use for photo descriptions only        |
| Budget multimodal        | `llava:13b`           | 13B  | ~10GB | Alternative to llama3.2-vision                      |


Default recommendation: `llama3.2-vision:11b` — handles both text and image analysis in single pass.

---

## Verification

1. `pnpm enrich-listing --slug <slug> --dry-run` — listing found, catalog loaded, LLM called, proposal written, no DB writes
2. Inspect `scripts/output/tag-proposals/<slug>.json` — valid JSON, slugs kebab-case, categories valid, `provider`/`model` fields present
3. `pnpm apply-tags scripts/output/tag-proposals/<slug>.json --dry-run` — logs without writing
4. `pnpm apply-tags <file>` (real) — tags created in DB, listing.tags updated; confirm in Payload admin
5. Re-run `enrich-listing` same slug without `--force` → `[SKIP]`; with `--force` but unchanged fingerprint → still skip unless `--force-revalidate`
6. `pnpm import-address --address "..." --auto-approve-tags` — end-to-end: scrape + photos + string-match + AI + listing with merged tags; `[PHOTOS]` + `[TOKENS]` logs appear
7. Photo download: media docs visible in Payload admin; listing.photos populated with correct count
8. `LLM_PROVIDER` unset → import-address skips inference gracefully (`[SKIP] LLM not configured`), photos still downloaded
9. Tampered proposal JSON → Zod validation rejects with descriptive error
10. LLM outputs invalid slug/category → Zod validation catches; logged as `[VALIDATION ERROR]`
11. Two-pass mode (`LLM_VISION_MODEL` set to different model): both models called, photo descriptions injected into text prompt
12. `--no-tag-limit` → no cap on new tag proposals
13. `--skip-photos --skip-inference` on import-address → listing created with string-match tags only, no photos, no LLM call
14. Re-run with unchanged input and no `--force-revalidate` → fingerprint match skip, no new proposal/tags
15. Re-run unchanged input with `--force-revalidate` → LLM called and proposal metadata updated
16. Proposal with `newCategoryProposals` + no `--apply-reclassifications` → warning only, no category writes
17. After taxonomy update + `--apply-reclassifications` → listed existing tags moved to new category
18. `downloadPhotos` receives untrusted host URL → skipped with warning; trusted hosts still ingest
19. `enrich-listing` in local Supabase env reads media bytes via local storage origin and infers successfully
20. `enrich-listing` in prod env reads media bytes via Supabase project origin and infers successfully

