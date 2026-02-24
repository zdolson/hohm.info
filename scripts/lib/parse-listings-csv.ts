import { parse } from "csv-parse/sync";
import { isValidSlug } from "../../src/lib/validate";

const VALID_PROPERTY_TYPES = [
  "singleFamily",
  "condo",
  "townhouse",
  "multiFamily",
  "land",
  "mobileHome",
] as const;

const VALID_STATUSES = ["active", "pending", "sold", "offMarket"] as const;

const VALID_EVENT_TYPES = [
  "listed",
  "priceChange",
  "pending",
  "active",
  "sold",
  "listedForRent",
  "listingRemoved",
] as const;

type PropertyType = (typeof VALID_PROPERTY_TYPES)[number];
type Status = (typeof VALID_STATUSES)[number];
type EventType = (typeof VALID_EVENT_TYPES)[number];

export interface ListingEvent {
  date: string;
  eventType: EventType;
  price?: number;
  source?: string;
  mlsNumber?: string;
}

export interface ListingRow {
  title?: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  region?: string;
  yearBuilt?: number;
  price?: number;
  garageSpaces?: number;
  summary?: string;
  sourceUrl?: string;
  location?: { zipCode?: string; county?: string };
  property?: { propertyType?: PropertyType; status?: Status; stories?: number };
  interior?: {
    bedrooms?: number;
    bathroomsFull?: number;
    bathroomsHalf?: number;
    squareFootage?: number;
    fireplaces?: number;
  };
  lot?: { lotSize?: number };
  financial?: { annualTaxes?: number; taxYear?: number };
  tags?: string[]; // slugs
  listingEvents?: ListingEvent[];
}

export interface RowError {
  index: number;
  messages: string[];
}

export interface RowResult<T> {
  ok: T[];
  errors: RowError[];
}

function parseOptionalNum(
  val: string | undefined,
  fieldName: string,
  messages: string[]
): number | undefined {
  if (!val?.trim()) return undefined;
  const n = Number(val.trim());
  if (isNaN(n) || n < 0) {
    messages.push(`${fieldName} must be a non-negative number`);
    return undefined;
  }
  return n;
}

export function parseListingsCsv(csv: string): RowResult<ListingRow> {
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const ok: ListingRow[] = [];
  const errors: RowError[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const messages: string[] = [];
    const index = i + 2;

    // Required fields
    if (!row.slug?.trim()) {
      messages.push("slug is required");
    } else if (!isValidSlug(row.slug.trim())) {
      messages.push(
        `slug "${row.slug}" is invalid (lowercase alphanumeric + hyphens only)`
      );
    }
    if (!row.address?.trim()) messages.push("address is required");
    if (!row.city?.trim()) messages.push("city is required");
    if (!row.state?.trim()) messages.push("state is required");

    if (row.sourceUrl?.trim() && !/^https?:\/\//.test(row.sourceUrl.trim())) {
      messages.push(`sourceUrl "${row.sourceUrl}" must start with http/https`);
    }

    const yearBuilt = parseOptionalNum(row.yearBuilt, "yearBuilt", messages);
    const price = parseOptionalNum(row.price, "price", messages);
    const garageSpaces = parseOptionalNum(
      row.garageSpaces,
      "garageSpaces",
      messages
    );

    // Location group
    const zip = row["location.zipCode"]?.trim();
    const county = row["location.county"]?.trim();
    const location =
      zip || county
        ? { zipCode: zip || undefined, county: county || undefined }
        : undefined;

    // Property group
    const propType = row["property.propertyType"]?.trim();
    const propStatus = row["property.status"]?.trim();
    const propStoriesRaw = row["property.stories"]?.trim();

    if (propType && !VALID_PROPERTY_TYPES.includes(propType as PropertyType)) {
      messages.push(
        `property.propertyType "${propType}" is invalid (valid: ${VALID_PROPERTY_TYPES.join(", ")})`
      );
    }
    if (propStatus && !VALID_STATUSES.includes(propStatus as Status)) {
      messages.push(
        `property.status "${propStatus}" is invalid (valid: ${VALID_STATUSES.join(", ")})`
      );
    }
    const propStories = parseOptionalNum(
      propStoriesRaw,
      "property.stories",
      messages
    );
    const property =
      propType || propStatus || propStories !== undefined
        ? {
            propertyType: VALID_PROPERTY_TYPES.includes(
              propType as PropertyType
            )
              ? (propType as PropertyType)
              : undefined,
            status: VALID_STATUSES.includes(propStatus as Status)
              ? (propStatus as Status)
              : undefined,
            stories: propStories,
          }
        : undefined;

    // Interior group
    const beds = parseOptionalNum(
      row["interior.bedrooms"],
      "interior.bedrooms",
      messages
    );
    const bathsFull = parseOptionalNum(
      row["interior.bathroomsFull"],
      "interior.bathroomsFull",
      messages
    );
    const bathsHalf = parseOptionalNum(
      row["interior.bathroomsHalf"],
      "interior.bathroomsHalf",
      messages
    );
    const sqft = parseOptionalNum(
      row["interior.squareFootage"],
      "interior.squareFootage",
      messages
    );
    const fires = parseOptionalNum(
      row["interior.fireplaces"],
      "interior.fireplaces",
      messages
    );
    const interior =
      beds !== undefined ||
      bathsFull !== undefined ||
      bathsHalf !== undefined ||
      sqft !== undefined ||
      fires !== undefined
        ? {
            bedrooms: beds,
            bathroomsFull: bathsFull,
            bathroomsHalf: bathsHalf,
            squareFootage: sqft,
            fireplaces: fires,
          }
        : undefined;

    // Lot group
    const lotSize = parseOptionalNum(
      row["lot.lotSize"],
      "lot.lotSize",
      messages
    );
    const lot = lotSize !== undefined ? { lotSize } : undefined;

    // Financial group
    const taxes = parseOptionalNum(
      row["financial.annualTaxes"],
      "financial.annualTaxes",
      messages
    );
    const taxYear = parseOptionalNum(
      row["financial.taxYear"],
      "financial.taxYear",
      messages
    );
    const financial =
      taxes !== undefined || taxYear !== undefined
        ? { annualTaxes: taxes, taxYear }
        : undefined;

    // Tags (comma-separated slugs)
    const tags = row.tags?.trim()
      ? row.tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    // Listing events (JSON array)
    let listingEvents: ListingEvent[] | undefined;
    if (row.listingEvents?.trim()) {
      try {
        const parsed: unknown = JSON.parse(row.listingEvents.trim());
        if (!Array.isArray(parsed)) {
          messages.push("listingEvents must be a JSON array");
        } else {
          const evErrors: string[] = [];
          for (const ev of parsed as Record<string, string>[]) {
            if (!ev.date) evErrors.push("listingEvent missing date");
            if (!ev.eventType) {
              evErrors.push("listingEvent missing eventType");
            } else if (!VALID_EVENT_TYPES.includes(ev.eventType as EventType)) {
              evErrors.push(
                `listingEvent eventType "${ev.eventType}" is invalid (valid: ${VALID_EVENT_TYPES.join(", ")})`
              );
            }
          }
          messages.push(...evErrors);
          if (evErrors.length === 0) {
            listingEvents = parsed as ListingEvent[];
          }
        }
      } catch {
        messages.push("listingEvents is not valid JSON");
      }
    }

    if (messages.length > 0) {
      errors.push({ index, messages });
    } else {
      ok.push({
        title: row.title?.trim() || undefined,
        slug: row.slug.trim(),
        address: row.address.trim(),
        city: row.city.trim(),
        state: row.state.trim(),
        region: row.region?.trim() || undefined,
        yearBuilt,
        price,
        garageSpaces,
        summary: row.summary?.trim() || undefined,
        sourceUrl: row.sourceUrl?.trim() || undefined,
        location,
        property,
        interior,
        lot,
        financial,
        tags,
        listingEvents,
      });
    }
  }

  return { ok, errors };
}
