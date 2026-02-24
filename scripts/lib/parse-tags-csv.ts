import { parse } from "csv-parse/sync";
import { isValidSlug } from "../../src/lib/validate";

const VALID_CATEGORIES = [
  "style",
  "exterior",
  "roofing",
  "structure",
  "systems",
  "utilities",
  "interior",
  "parking",
  "features",
  "hazards",
  "era",
  "region",
] as const;

type TagCategory = (typeof VALID_CATEGORIES)[number];
type ResourceType = "link" | "youtube" | "guide" | "cost";

export interface TagRow {
  name: string;
  slug: string;
  category: TagCategory;
  description?: string;
  resources?: Array<{ label: string; url: string; type?: ResourceType }>;
}

export interface RowError {
  index: number;
  messages: string[];
}

export interface RowResult<T> {
  ok: T[];
  errors: RowError[];
}

const VALID_RESOURCE_TYPES: ResourceType[] = [
  "link",
  "youtube",
  "guide",
  "cost",
];

export function parseTagsCsv(csv: string): RowResult<TagRow> {
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const ok: TagRow[] = [];
  const errors: RowError[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const messages: string[] = [];
    const index = i + 2; // 1-based row, +1 for header

    if (!row.name?.trim()) messages.push("name is required");

    if (!row.slug?.trim()) {
      messages.push("slug is required");
    } else if (!isValidSlug(row.slug.trim())) {
      messages.push(
        `slug "${row.slug}" is invalid (lowercase alphanumeric + hyphens only)`
      );
    }

    if (!row.category?.trim()) {
      messages.push("category is required");
    } else if (!VALID_CATEGORIES.includes(row.category.trim() as TagCategory)) {
      messages.push(
        `category "${row.category}" is invalid (valid: ${VALID_CATEGORIES.join(", ")})`
      );
    }

    let resources: TagRow["resources"] | undefined;
    if (row.resources?.trim()) {
      try {
        const parsed: unknown = JSON.parse(row.resources.trim());
        if (!Array.isArray(parsed)) {
          messages.push("resources must be a JSON array");
        } else {
          const resourceErrors: string[] = [];
          for (const r of parsed as Record<string, string>[]) {
            if (!r.label) resourceErrors.push("resource missing label");
            if (!r.url || !/^https?:\/\//.test(r.url))
              resourceErrors.push(
                `resource url "${r.url ?? ""}" must start with http/https`
              );
            if (
              r.type &&
              !VALID_RESOURCE_TYPES.includes(r.type as ResourceType)
            )
              resourceErrors.push(
                `resource type "${r.type}" is invalid (valid: ${VALID_RESOURCE_TYPES.join(", ")})`
              );
          }
          messages.push(...resourceErrors);
          if (resourceErrors.length === 0) {
            resources = parsed as TagRow["resources"];
          }
        }
      } catch {
        messages.push("resources is not valid JSON");
      }
    }

    if (messages.length > 0) {
      errors.push({ index, messages });
    } else {
      ok.push({
        name: row.name.trim(),
        slug: row.slug.trim(),
        category: row.category.trim() as TagCategory,
        description: row.description?.trim() || undefined,
        resources,
      });
    }
  }

  return { ok, errors };
}
