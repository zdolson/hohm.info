/**
 * Builds a Payload `where` object for the listings collection from URL search params.
 * Tag filtering is resolved by the caller (slug → ID); pass resolved tagIds here.
 * All string/numeric params are sanitized (slug allowlist, enum allowlist, length, clamp).
 */

import {
  propertyTypeOptions,
  statusOptions,
  type PropertyTypeValue,
  type StatusValue,
} from "@/collections/Listings";
import { isValidSlug } from "@/lib/validate";

export type ListingsSearchParams = {
  /** Resolved tag IDs (caller resolves tag slugs from URL to IDs). */
  tagIds?: number[];
  bedrooms?: number;
  bathroomsFull?: number;
  squareFootageMin?: number;
  squareFootageMax?: number;
  garageSpaces?: number;
  propertyType?: PropertyTypeValue;
  status?: StatusValue;
  state?: string;
  city?: string;
  address?: string;
};

/** Payload where clause shape for listings (subset we build). */
type WhereClause = Record<string, unknown>;

const PROPERTY_TYPE_VALUES: Set<PropertyTypeValue> = new Set(
  propertyTypeOptions.map((o) => o.value)
);
const STATUS_VALUES: Set<StatusValue> = new Set(
  statusOptions.map((o) => o.value)
);

const MAX_STATE_LEN = 50;
const MAX_CITY_LEN = 100;
const MAX_ADDRESS_LEN = 200;
const MAX_COUNT = 50; // bedrooms, bathroomsFull, garageSpaces
const MAX_SQFT = 10_000_000;
const MAX_PAGE = 10_000;

function parseNum(value: unknown, max?: number): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  if (max !== undefined && n > max) return max;
  return n;
}

function parseStr(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s === "" ? undefined : s;
}

function parseStrMax(value: unknown, maxLen: number): string | undefined {
  const s = parseStr(value);
  if (s === undefined) return undefined;
  return s.length > maxLen ? undefined : s;
}

function parseTags(raw: unknown): string[] | undefined {
  let values: string[] = [];
  if (typeof raw === "string") {
    values = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } else if (Array.isArray(raw)) {
    values = raw.flatMap((v) =>
      typeof v === "string"
        ? v
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : []
    );
  }
  const valid = values.filter(isValidSlug);
  return valid.length > 0 ? valid : undefined;
}

/**
 * Parsed search params from URL. Includes `tags` (slugs) for caller to resolve to tagIds.
 */
export type ParsedListingsSearchParams = ListingsSearchParams & {
  tags?: string[];
  page?: number;
};

/**
 * Parse and sanitize listing search params from URL searchParams.
 * Tags must be valid slugs; propertyType/status must be in collection allowlist;
 * state/city/address trimmed and length-limited; numerics clamped to max.
 */
export function parseListingsSearchParams(
  raw: Record<string, unknown> | undefined
): ParsedListingsSearchParams {
  const params = raw ?? {};
  const tags = parseTags(params.tags);
  const rawPropertyType = parseStr(params.propertyType);
  const propertyType =
    rawPropertyType !== undefined &&
    PROPERTY_TYPE_VALUES.has(rawPropertyType as PropertyTypeValue)
      ? (rawPropertyType as PropertyTypeValue)
      : undefined;
  const rawStatus = parseStr(params.status);
  const status =
    rawStatus !== undefined && STATUS_VALUES.has(rawStatus as StatusValue)
      ? (rawStatus as StatusValue)
      : undefined;
  const page = Math.max(1, parseNum(params.page, MAX_PAGE) ?? 1);
  return {
    tags,
    tagIds: undefined,
    bedrooms: parseNum(params.bedrooms, MAX_COUNT),
    bathroomsFull: parseNum(params.bathroomsFull, MAX_COUNT),
    squareFootageMin: parseNum(params.squareFootageMin, MAX_SQFT),
    squareFootageMax: parseNum(params.squareFootageMax, MAX_SQFT),
    garageSpaces: parseNum(params.garageSpaces, MAX_COUNT),
    propertyType,
    status,
    state: parseStrMax(params.state, MAX_STATE_LEN),
    city: parseStrMax(params.city, MAX_CITY_LEN),
    address: parseStrMax(params.address, MAX_ADDRESS_LEN),
    page,
  };
}

/**
 * Build Payload `where` for listings find(). Pass parsed params; for tags, resolve
 * slug(s) to IDs and set tagIds. Returns undefined if no constraints (list all).
 */
export function buildListingsWhere(
  params: ListingsSearchParams
): WhereClause | undefined {
  const conditions: WhereClause[] = [];

  if (params.tagIds?.length) {
    for (const id of params.tagIds) {
      conditions.push({ tags: { contains: id } });
    }
  }

  const interior: WhereClause = {};
  if (params.bedrooms !== undefined) {
    interior.bedrooms = { greater_than_equal: params.bedrooms };
  }
  if (params.bathroomsFull !== undefined) {
    interior.bathroomsFull = { greater_than_equal: params.bathroomsFull };
  }
  if (
    params.squareFootageMin !== undefined ||
    params.squareFootageMax !== undefined
  ) {
    const sq: WhereClause = {};
    if (params.squareFootageMin !== undefined)
      sq.greater_than_equal = params.squareFootageMin;
    if (params.squareFootageMax !== undefined)
      sq.less_than_equal = params.squareFootageMax;
    interior.squareFootage = sq;
  }
  if (Object.keys(interior).length) conditions.push({ interior });

  if (params.garageSpaces !== undefined) {
    conditions.push({
      garageSpaces: { greater_than_equal: params.garageSpaces },
    });
  }

  const property: WhereClause = {};
  if (params.propertyType !== undefined) {
    property.propertyType = { equals: params.propertyType };
  }
  if (params.status !== undefined) {
    property.status = { equals: params.status };
  }
  if (Object.keys(property).length) conditions.push({ property });

  if (params.state !== undefined) {
    conditions.push({ state: { equals: params.state } });
  }
  if (params.city !== undefined) {
    conditions.push({ city: { contains: params.city } });
  }
  if (params.address !== undefined) {
    conditions.push({ address: { contains: params.address } });
  }

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return { and: conditions };
}

/**
 * Build /listings URL with given params. Omits empty/undefined. Use for form action and pagination links.
 */
export function buildListingsUrl(
  params: ParsedListingsSearchParams,
  overrides?: { page?: number }
): string {
  const q = new URLSearchParams();
  const page = overrides?.page ?? params.page ?? 1;
  if (params.tags?.length) q.set("tags", params.tags.join(","));
  if (params.bedrooms !== undefined) q.set("bedrooms", String(params.bedrooms));
  if (params.bathroomsFull !== undefined)
    q.set("bathroomsFull", String(params.bathroomsFull));
  if (params.squareFootageMin !== undefined)
    q.set("squareFootageMin", String(params.squareFootageMin));
  if (params.squareFootageMax !== undefined)
    q.set("squareFootageMax", String(params.squareFootageMax));
  if (params.garageSpaces !== undefined)
    q.set("garageSpaces", String(params.garageSpaces));
  if (params.propertyType) q.set("propertyType", params.propertyType);
  if (params.status) q.set("status", params.status);
  if (params.state) q.set("state", params.state);
  if (params.city) q.set("city", params.city);
  if (params.address) q.set("address", params.address);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/listings?${s}` : "/listings";
}
