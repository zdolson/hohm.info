/** Maps scraped attribute substrings (lowercase) to tag slugs. */
const ATTRIBUTE_TAG_MAP: Array<[string, string]> = [
  ["forced air", "forced-air-heating"],
  ["brick", "brick-exterior"],
  ["wood siding", "wood-exterior"],
  ["vinyl siding", "wood-exterior"],
  ["cedar siding", "wood-exterior"],
  ["asphalt shingle", "asphalt-shingle"],
  ["full basement", "full-basement"],
  ["hardwood", "hardwood-floors"],
  ["tile", "tile-flooring"],
  ["knob and tube", "knob-and-tube-wiring"],
  ["knob-and-tube", "knob-and-tube-wiring"],
  ["natural gas", "natural-gas"],
  ["public water", "public-water"],
  ["city water", "public-water"],
  ["municipal water", "public-water"],
  ["public sewer", "public-sewer"],
  ["city sewer", "public-sewer"],
  ["municipal sewer", "public-sewer"],
  ["attached garage", "attached-garage"],
  ["side-facing garage", "side-facing-garage"],
  ["side facing garage", "side-facing-garage"],
  ["fireplace", "fireplace"],
  ["fenced", "fenced-yard"],
  ["ranch", "ranch"],
  ["victorian", "victorian"],
  ["replacement windows", "replacement-windows"],
  ["main level primary", "main-level-primary"],
  ["main-level primary", "main-level-primary"],
  ["basement laundry", "basement-laundry"],
  ["slate", "asphalt-shingle"],
];

/**
 * Given raw scraped attribute strings, return matched tag slugs.
 * Unmatched attributes are logged as warnings.
 */
export function inferTagSlugs(attrs: string[]): string[] {
  const matched = new Set<string>();

  for (const attr of attrs) {
    const lower = attr.toLowerCase();
    let found = false;
    for (const [keyword, slug] of ATTRIBUTE_TAG_MAP) {
      if (lower.includes(keyword)) {
        matched.add(slug);
        found = true;
      }
    }
    if (!found) {
      console.log(`[WARN] No tag for attribute: "${attr}"`);
    }
  }

  return Array.from(matched);
}
