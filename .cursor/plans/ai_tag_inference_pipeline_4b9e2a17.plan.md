# AI Tag Inference Pipeline

## Context
Current `infer-tags.ts` does naive string-matching on 33 hardcoded keyword→slug pairs from Zillow's raw attribute fields. This misses tags not surfaced as structured attributes (visual features in photos, contextual inference from year/location/price, novel features with no existing tag). The goal is a Claude-powered inference layer that:
- Analyzes all listing fields + up to 6 Zillow photos (vision)
- Matches existing DB tags and proposes new ones
- Stays constrained to 12 categories by default; can propose a new category only when genuinely warranted + would reclassify existing tags
- Defaults to a human-review JSON file; `--auto-approve-tags` skips review
- Runs standalone (`enrich-listing`) or inline during `import-address`

---

## New Files

| File | Purpose |
|---|---|
| `scripts/lib/ai-tag-inference.ts` | Core Claude inference module |
| `scripts/lib/apply-proposal.ts` | Shared helper — create tags + update listing |
| `scripts/enrich-listing.ts` | Standalone CLI: `--slug`/`--all`, `--force`, `--auto-approve-tags`, `--dry-run` |
| `scripts/apply-tags.ts` | Apply a saved proposal JSON to DB |
| `scripts/output/.gitkeep` | Ensure output dir exists in repo |

## Modified Files

| File | Change |
|---|---|
| `scripts/lib/fetcher.ts` | Add `photoUrls?: string[]` to `ScrapedProperty` |
| `scripts/lib/fetchers/zillow.ts` | Add `extractPhotoUrls(data)` helper; populate `photoUrls` in `mapZillowResult` |
| `scripts/import-address.ts` | Parse `--auto-approve-tags`; add step 8 AI inference after listing creation |
| `package.json` | Add `enrich-listing` + `apply-tags` scripts; add `@anthropic-ai/sdk` to deps |
| `.env.example` | Add `ANTHROPIC_API_KEY` placeholder |
| `.gitignore` | Ignore `scripts/output/tag-proposals/*.json` |

---

## Key Interfaces (`scripts/lib/ai-tag-inference.ts`)

```ts
export type TagCategory =
  "style"|"exterior"|"roofing"|"structure"|"systems"|"utilities"|
  "interior"|"parking"|"features"|"hazards"|"era"|"region";

export interface InferenceInput {
  listing: {
    slug: string; address: string; city: string; state: string;
    yearBuilt?: number; price?: number; summary?: string;
    property?: { propertyType?: string; status?: string; stories?: number };
    interior?: { bedrooms?: number; bathroomsFull?: number; bathroomsHalf?: number;
                 squareFootage?: number; fireplaces?: number };
    lot?: { lotSize?: number };
    garageSpaces?: number;
    rawAttributes: string[];
  };
  photoUrls: string[];            // up to 6, passed as Claude vision URL blocks
  existingTags: Array<{           // full DB catalog — Claude prefers matching these
    slug: string; name: string; category: TagCategory; description?: string;
  }>;
}

export interface NewTagProposal {
  name: string; slug: string; category: TagCategory;
  description: string;            // 1–2 sentences
  confidence: "high"|"medium"|"low";
  rationale: string;              // cite evidence (attribute string or photo observation)
}

export interface NewCategoryProposal {
  name: string; slug: string;     // new category key
  justification: string;
  existingTagsToReclassify: string[];  // existing slugs that would move here
}

export interface InferenceResult {
  existingTagSlugs: string[];
  newTagProposals: NewTagProposal[];
  newCategoryProposals: NewCategoryProposal[];  // nearly always []
  tokenUsage: { inputTokens: number; outputTokens: number };
}
```

---

## Claude Prompt Strategy

**Model**: `claude-sonnet-4-6` | **max_tokens**: 1024

**System prompt** (static):
- Full 12-category taxonomy with examples per category
- Existing DB tags rendered as a readable list (slug + name + category), injected at call time
- Rules:
  1. Return JSON only — no markdown wrapper
  2. `existingTagSlugs` — slugs from DB catalog only (no invention here)
  3. `newTagProposals` — only when no existing tag covers the concept; kebab-case slug
  4. Era inference from `yearBuilt` (Victorian ≤1900, Edwardian 1901–10, Pre-War 1911–45, Post-War 1946–69, Modern 1970–99, Contemporary 2000+)
  5. `newCategoryProposals` — ONLY when genuinely distinct from all 12 AND ≥2 existing tags would reclassify; must provide justification + `existingTagsToReclassify` list
  6. Photo guidance: identify exterior material, roof, garage, deck/pool/porch; mark `confidence: "low"` if inferred from photo alone
  7. Do not hallucinate; when attribute + photo conflict, prefer attribute

**User message**: Structured text block (all listing fields) + up to 6 `{type:"image", source:{type:"url", url}}` content blocks

**JSON extraction**: Regex strips optional ` ```json ` fence; fallback to `{...}` brace slice; throws descriptive error if neither found

---

## Proposal File Schema (`scripts/output/tag-proposals/{slug}.json`)

```json
{
  "listingSlug": "2115-anderson-dr-se-east-grand-rapids",
  "generatedAt": "2026-02-23T14:32:00.000Z",
  "model": "claude-sonnet-4-6",
  "tokenUsage": { "inputTokens": 1842, "outputTokens": 318 },
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

Human edits the file before running `apply-tags`. The file is self-contained (no re-inference needed).

---

## `scripts/lib/apply-proposal.ts` (shared helper)

Used by both `enrich-listing.ts` and `import-address.ts`.

```ts
export async function applyProposal(
  listingId: number,
  currentTagIds: number[],
  result: InferenceResult,
  catalogSlugToId: Map<string, number>,
  payload: Payload,
  dryRun: boolean,
): Promise<void>
```

Steps:
1. Resolve `existingTagSlugs` → IDs via `catalogSlugToId` map
2. Create each `newTagProposals` item: `payload.create({ collection:"tags", data:{name,slug,category,description}, overrideAccess:true })`
3. For `newCategoryProposals`: log warning ("new categories require updating Tags.ts enum + payload.config — manual step"); list which existing tags would reclassify; skip DB writes for these
4. Union `currentTagIds + resolved + new IDs`, deduplicate
5. `payload.update({ collection:"listings", id, data:{ tags: mergedIds }, overrideAccess:true })`
6. With `--dry-run`: log all actions, skip writes

---

## `scripts/lib/fetchers/zillow.ts` — Photo Extraction

Add `extractPhotoUrls(data: any): string[]` helper that tries 5 shapes in priority order:
1. `data.photos[].url` (string) or `data.photos[]` (string)
2. `data.carouselPhotos[].url` or `.mixedSources.jpeg[0].url`
3. `data.images[]` (string or `.url`)
4. `data.hiResPicture` (single string)
5. `data.miniCardPhotos[].url`

Dedup + return `slice(0, 6)`. Add `photoUrls: extractPhotoUrls(data)` to `mapZillowResult` return.

---

## `scripts/enrich-listing.ts` Flow

```
parseArgs → getPayload → load listing(s) → load full tag catalog
For each listing:
  → skip if tags.length > 0 && !--force  [SKIP]
  → build InferenceInput (photoUrls: [] for DB-loaded, log [WARN] vision unavailable)
  → inferTags() → Claude API
  → log [TOKENS] input=N output=N
  → without --auto-approve-tags:
      mkdirSync(scripts/output/tag-proposals, {recursive:true})
      write {slug}.json → print [PROPOSAL] + apply-tags instruction
  → with --auto-approve-tags:
      applyProposal() → [CREATED TAG] / [APPLIED] / [DRY-RUN] logs
→ payload.db.destroy()
```

Note: `--all` processes sequentially (no parallel) to respect Claude API rate limits.

---

## `scripts/import-address.ts` Integration (step 8)

After step 7 (listing created), adds:
```
→ load full tag catalog from DB
→ build InferenceInput with scraped.photoUrls (available from live scrape)
→ inferTags() → Claude API
→ log [TOKENS]
→ without --auto-approve-tags: write proposal JSON + print instruction
→ with --auto-approve-tags: applyProposal() → update listing.tags to union(stringMatch + AI)
```

String-match tags (steps 3–4) and AI tags are merged (union) — no double-counting, just additive.

---

## `scripts/apply-tags.ts` Flow

```
read + parse <file>
validate schema (listingSlug, existingTagSlugs, newTagProposals present)
getPayload → find listing by slug
load tag catalog for slug resolution
applyProposal() with dryRun flag
payload.db.destroy()
```

---

## New Category Handling

Since `category` is a Payload `select` field enum in `src/collections/Tags.ts`, new categories **cannot be added programmatically** — they require a code change to `Tags.ts` + regenerating types. When `newCategoryProposals` is non-empty:
- Log a clear warning with the justification and reclassification list
- Do NOT create tags under the new category (would fail Payload validation)
- Print actionable instructions: "Add '{category}' to Tags.ts select options, run `pnpm generate:types`, then re-run apply-tags"

---

## Verification

1. `pnpm enrich-listing --slug 2115-anderson-dr-se-east-grand-rapids --dry-run` — listing found, catalog loaded, Claude called, proposal file written, no DB writes
2. Inspect `scripts/output/tag-proposals/2115-anderson-dr-se-east-grand-rapids.json` — valid JSON, slugs kebab-case, categories valid
3. `pnpm apply-tags scripts/output/tag-proposals/2115-anderson-dr-se-east-grand-rapids.json --dry-run` — logs without writing
4. `pnpm apply-tags <file>` (real) — tags created in DB, listing.tags updated; confirm in Payload admin
5. Re-run `enrich-listing` same slug without `--force` — logs `[SKIP]`; with `--force` — re-infers
6. `pnpm import-address --address "2115 Anderson Dr SE, East Grand Rapids, MI" --auto-approve-tags` — end-to-end: scrape + string-match + AI + create listing with merged tags; `[TOKENS]` log appears
7. Photo URLs: confirm `scraped.photoUrls` is populated (may be empty for some actors) — inference falls back gracefully to text-only
