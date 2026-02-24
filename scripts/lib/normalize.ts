import type { ScrapedProperty } from "./fetcher";

const VALID_PROPERTY_TYPES = [
  "singleFamily",
  "condo",
  "townhouse",
  "multiFamily",
  "land",
  "mobileHome",
] as const;

const VALID_STATUSES = ["active", "pending", "sold", "offMarket"] as const;

type PropertyType = (typeof VALID_PROPERTY_TYPES)[number];
type Status = (typeof VALID_STATUSES)[number];

export interface ListingCreateData {
  title: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  yearBuilt?: number;
  price?: number;
  garageSpaces?: number;
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
  listingEvents?: Array<{
    date: string;
    eventType: ScrapedProperty["listingEvents"][number]["eventType"];
    price?: number;
    source?: string;
    mlsNumber?: string;
  }>;
  tags: number[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Map scraped property data + resolved tag IDs to Payload create shape. */
export function normalizeToListing(
  scraped: ScrapedProperty,
  tagIds: number[]
): ListingCreateData {
  const slug = slugify(`${scraped.address}-${scraped.city}-${scraped.state}`);
  const title = scraped.title || scraped.address;

  const propertyType = VALID_PROPERTY_TYPES.includes(
    scraped.propertyType as PropertyType
  )
    ? (scraped.propertyType as PropertyType)
    : undefined;

  const status = VALID_STATUSES.includes(scraped.status as Status)
    ? (scraped.status as Status)
    : undefined;

  const hasLocation = scraped.zipCode || scraped.county;
  const hasProperty = propertyType || status || scraped.stories !== undefined;
  const hasInterior =
    scraped.beds !== undefined ||
    scraped.bathsFull !== undefined ||
    scraped.bathsHalf !== undefined ||
    scraped.sqft !== undefined ||
    scraped.fireplaces !== undefined;

  return {
    title,
    slug,
    address: scraped.address,
    city: scraped.city,
    state: scraped.state,
    yearBuilt: scraped.yearBuilt,
    price: scraped.price,
    garageSpaces: scraped.garageSpaces,
    sourceUrl: scraped.sourceUrl,
    location: hasLocation
      ? { zipCode: scraped.zipCode, county: scraped.county }
      : undefined,
    property: hasProperty
      ? { propertyType, status, stories: scraped.stories }
      : undefined,
    interior: hasInterior
      ? {
          bedrooms: scraped.beds,
          bathroomsFull: scraped.bathsFull,
          bathroomsHalf: scraped.bathsHalf,
          squareFootage: scraped.sqft,
          fireplaces: scraped.fireplaces,
        }
      : undefined,
    lot:
      scraped.lotSize !== undefined ? { lotSize: scraped.lotSize } : undefined,
    financial:
      scraped.annualTaxes !== undefined || scraped.taxYear !== undefined
        ? { annualTaxes: scraped.annualTaxes, taxYear: scraped.taxYear }
        : undefined,
    listingEvents: scraped.listingEvents,
    tags: tagIds,
  };
}
