/** Gemini API rejects schemas with top-level or nested $ref; inline definitions. */

function inlineRefs(
  value: unknown,
  defs: Record<string, unknown> | undefined
): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => inlineRefs(v, defs));
  const obj = value as Record<string, unknown>;
  const ref = obj.$ref as string | undefined;
  if (ref !== undefined && defs !== undefined) {
    const key = ref.replace(/^#\/(?:definitions?|$defs)\//, "");
    const resolved = defs[key];
    if (
      resolved !== undefined &&
      typeof resolved === "object" &&
      resolved !== null
    ) {
      return inlineRefs(resolved, defs);
    }
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "$ref") continue;
    out[k] = inlineRefs(v, defs);
  }
  return out;
}

export function flattenSchemaForGemini(
  schema: Record<string, unknown>
): Record<string, unknown> {
  const defs =
    (schema.definitions as Record<string, unknown> | undefined) ??
    (schema.$defs as Record<string, unknown> | undefined);
  const ref = schema.$ref as string | undefined;
  let root: Record<string, unknown> = schema;
  if (ref !== undefined && defs !== undefined) {
    const key = ref.replace(/^#\/(?:definitions?|$defs)\//, "");
    const resolved = defs[key];
    if (
      resolved !== undefined &&
      typeof resolved === "object" &&
      resolved !== null &&
      !Array.isArray(resolved)
    ) {
      root = { ...(resolved as Record<string, unknown>) };
    }
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(root)) {
    if (k === "definitions" || k === "$defs" || k === "$schema") continue;
    out[k] = inlineRefs(v, defs);
  }
  return out;
}
