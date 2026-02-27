/**
 * Gemini pricing (per 1M tokens, USD).
 * Standard: https://ai.google.dev/gemini-api/docs/pricing
 * Batch: 50% off.
 */
const RATES: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "gemini-2.5-flash": { inputPer1M: 0.3, outputPer1M: 2.5 },
};

const BATCH_DISCOUNT = 0.5;

/** Normalize model name for rate lookup (strip -preview-*, version suffixes). */
function modelKey(model: string): string {
  const base = model.split("-preview")[0].split(":")[0].trim();
  return base.length > 0 ? base : "gemini-2.5-flash";
}

/**
 * Estimate cost in USD for a single request or batch response.
 * @param opts.batch - If true, apply 50% batch discount.
 */
export function estimateCost(
  model: string,
  tokenUsage: { inputTokens: number; outputTokens: number },
  opts: { batch?: boolean } = {}
): number {
  const key = modelKey(model);
  if (!(key in RATES)) {
    console.warn(
      `[WARN]    Unknown model "${model}" for cost estimation; using gemini-2.5-flash rates.`
    );
  }
  const rates = RATES[key] ?? RATES["gemini-2.5-flash"];
  const discount = opts.batch === true ? BATCH_DISCOUNT : 1;
  const cost =
    ((tokenUsage.inputTokens / 1_000_000) * rates.inputPer1M +
      (tokenUsage.outputTokens / 1_000_000) * rates.outputPer1M) *
    discount;
  return cost;
}
