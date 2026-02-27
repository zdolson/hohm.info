import path from "path";
import { fileURLToPath } from "url";

/** When true, scripts may write debug artifacts (prompts, images, HTML dumps). Set from CLI --debug. */
let debugMode = false;

/** Current address/slug scope for debug output. When set, artifacts go under output/debug/{slug}/. */
let debugAddressSlug: string | null = null;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getDebugMode(): boolean {
  return debugMode;
}

export function setDebugMode(value: boolean): void {
  debugMode = value;
}

export function getDebugAddressSlug(): string | null {
  return debugAddressSlug;
}

export function setDebugAddressSlug(slug: string | null): void {
  debugAddressSlug = slug;
}

/** Base directory for debug artifacts: scripts/output/debug */
export function getDebugDir(): string {
  return path.resolve(__dirname, "..", "output", "debug");
}

/** When an address slug is set, returns getDebugDir()/{slug}; otherwise getDebugDir(). */
export function getAddressDebugDir(): string {
  const base = getDebugDir();
  if (debugAddressSlug !== null && debugAddressSlug.length > 0) {
    return path.join(base, debugAddressSlug);
  }
  return base;
}
