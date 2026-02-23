import type { Validate } from "payload";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(s: string): boolean {
  return SLUG_RE.test(s);
}

export const slug: Validate<string | null | undefined> = (value) => {
  if (!value) return true;
  return (
    SLUG_RE.test(value) ||
    "Slug must be lowercase alphanumeric with hyphens (e.g. brick-exterior)"
  );
};

const SAFE_URL_RE = /^https?:\/\//;

export const safeUrl: Validate<string | null | undefined> = (value) => {
  if (!value) return true;
  return SAFE_URL_RE.test(value) || "URL must start with http:// or https://";
};
