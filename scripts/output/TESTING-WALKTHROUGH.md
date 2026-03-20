# Import + Gemini testing walkthrough (dry-run + --debug)

Use this to vet the multi-source fetcher and AI tag inference without writing to the DB. All commands use `--dry-run` and `--debug`.

## Prerequisites

- `LLM_PROVIDER=gemini` and `GEMINI_API_KEY` in `.env.local` (for inference).
- No `APIFY_TOKEN` needed for Trulia-only.

## 1. Single address, Trulia only (full flow)

**Command:**

```bash
pnpm import:address --address "https://www.trulia.com/home/408-w-king-st-owosso-mi-48867-122608427/" --sources trulia --dry-run --debug
```

**What happens:**

1. **Resolve adapters** — only Trulia; no Zillow.
2. **Fetch** — Trulia HTML scrape (or cache if present). With `--debug`, Trulia may write `output/debug/<slug>/http.html` or `browser.html` if it dumps HTML.
3. **Scraped output** — `output/debug/<slug>/scraped.json` (merged property; single source = Trulia only).
4. **Tag resolution** — rule-based tags from `rawAttributes`; in dry-run, new tags are not created in DB.
5. **Normalize** — listing shape built (not persisted in dry-run).
6. **Photos** — downloaded to temp; with `--debug`, copies go to `output/debug/<slug>/photos/` during inference.
7. **Gemini inference** — prompt + images sent; with `--debug`, `output/debug/<slug>/prompt.txt` and `photos/photo-0.jpg` etc. written.
8. **Proposal** — JSON written to `output/tag-proposals/<slug>-<timestamp>.json`; in dry-run, **no listing and no tags applied in DB**.

**Review checklist:**

- [ ] Console: `[FETCHED] trulia: ...` (or `[CACHE]` if you ran before).
- [ ] `scripts/output/debug/<address-slug>/scraped.json` — address, price, beds/baths, `rawAttributes`, `photos`, `listingEvents` present.
- [ ] `scripts/output/debug/<address-slug>/prompt.txt` — SYSTEM + USER sections; USER has listing text and note about images.
- [ ] `scripts/output/debug/<address-slug>/photos/` — image files used for inference.
- [ ] `[INFER]` / `[TOKENS]` / `[COST]` in console; no `[CREATED]` for listing (dry-run).
- [ ] `output/tag-proposals/*.json` — `newTagProposals`, `newCategoryProposals`, `existingTagSlugs`; no DB apply.

**Address slug** for that URL is typically like `https---www-trulia-com-home-408-w-king-st-owosso-mi-48867-122608427`. List debug dir:

```bash
ls -la scripts/output/debug/
```

---

## 2. Same address by street (no URL)

Ensures slugify → Trulia URL path works:

```bash
pnpm import:address --address "408 W King St, Owosso, MI 48867" --sources trulia --dry-run --debug
```

**Review:**

- [ ] Console shows Trulia fetch (or cache) and same debug artifacts under the slug for this address (e.g. `408-w-king-st-owosso-mi-48867` or similar).

---

## 3. Multi-source (Zillow + Trulia) — expect Zillow to fail without APIFY_TOKEN

```bash
pnpm import:address --address "408 W King St, Owosso, MI 48867" --sources zillow,trulia --dry-run --debug
```

**Review:**

- [ ] Console: `[ERROR] zillow: ...` (no APIFY_TOKEN), then `[FETCHED] trulia: ...`.
- [ ] Merged result still produced (Trulia only); `scraped.json` in debug dir is the merged payload.
- [ ] No DB writes (dry-run).

If you set `APIFY_TOKEN`, Zillow can succeed; merge priority is Zillow > Trulia (see plan).

---

## 4. Skip inference (scrape + normalize only)

Useful to validate fetcher and scraped data without calling Gemini:

```bash
pnpm import:address --address "408 W King St, Owosso, MI 48867" --sources trulia --dry-run --debug --skip-inference
```

**Review:**

- [ ] No `[INFER]` / `[TOKENS]`; no `prompt.txt` or `photos/` in debug dir (inference skipped).
- [ ] `scraped.json` still written; no proposal file.

---

## 5. Batch mode (Gemini-only, deferred inference)

Processes all addresses, then runs one Gemini batch (cheaper). Still use dry-run so no listing/tags in DB:

```bash
pnpm import:address --address "408 W King St, Owosso, MI 48867" --sources trulia --dry-run --debug --batch
```

**Review:**

- [ ] Each address: fetch + normalize; inference deferred (no per-address Gemini call).
- [ ] After all addresses: one batch Gemini call; then per-item proposal files.
- [ ] Debug artifacts per address still under `output/debug/<slug>/` (scrape, etc.); batch inference may not re-write prompt.txt per address (batch path may differ).
- [ ] No `[CREATED]` listing; no tags applied (dry-run).

---

## 6. Force refetch (bypass scrape cache)

To re-scrape and refresh debug HTML/scraped.json:

```bash
pnpm import:address --address "408 W King St, Owosso, MI 48867" --sources trulia --dry-run --debug --force-refetch
```

---

## 7. Apply a proposal (dry-run) after you’re happy

When you’re ready to test apply logic without persisting:

```bash
pnpm listing:apply-tags scripts/output/tag-proposals/<slug>-<timestamp>.json --dry-run
```

Inspect console; no DB updates.

---

## Quick reference

| Goal                   | Flags                                                  |
| ---------------------- | ------------------------------------------------------ |
| Full flow, one address | `--dry-run --debug --sources trulia`                   |
| No Gemini              | `--dry-run --debug --skip-inference`                   |
| Multi-source           | `--sources zillow,trulia` (Zillow fails without token) |
| Batch inference        | `--batch` (Gemini only)                                |
| Fresh scrape           | `--force-refetch`                                      |

All commands above use `--dry-run` so nothing is committed to the DB until you run without it.

---

## Cost comparison: single 60-photo vs chunked batch

Temporary script to compare cost of one call with many photos vs chunked batch (e.g. 3×20) with merged results:

```bash
pnpm test:inference-cost
# Or with a specific address:
pnpm test:inference-cost -- --address "https://www.trulia.com/home/..."
```

- **Single**: one `inferTags()` call with up to 60 photos.
- **Chunked**: photos split into chunks of 20; each chunk sent as one batch item; results merged (dedupe by slug).
- Prints both costs and difference. Requires Gemini; uses scrape cache or fetches once.
- For a true 60-photo comparison, use an address whose scrape has ≥60 photo URLs (script logs when fewer are available).
