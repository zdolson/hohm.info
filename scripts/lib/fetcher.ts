export interface ScrapedEvent {
  date: string;
  eventType:
    | "listed"
    | "priceChange"
    | "pending"
    | "active"
    | "sold"
    | "listedForRent"
    | "listingRemoved";
  price?: number;
  source?: string;
  mlsNumber?: string;
}

export interface FetcherAdapter {
  /** Unique source name used with --sources CLI arg */
  readonly name: string;
  fetch(input: string): Promise<ScrapedProperty>;
}

export interface ScrapedProperty {
  title?: string;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  county?: string;
  yearBuilt?: number;
  price?: number;
  beds?: number;
  bathsFull?: number;
  bathsHalf?: number;
  sqft?: number;
  lotSize?: number;
  stories?: number;
  propertyType?: string;
  status?: string;
  garageSpaces?: number;
  fireplaces?: number;
  annualTaxes?: number;
  taxYear?: number;
  listingEvents: ScrapedEvent[];
  /** Raw attribute strings from scraper, e.g. ['Forced Air', 'Brick', 'Full Basement'] */
  rawAttributes: string[];
  sourceUrl?: string;
  /** Photo URLs from scraper (e.g. Zillow); download + upload to media in import-address */
  photoUrls?: string[];
  /** Listing description from scraper */
  description?: string;
}

export interface AdapterMeta {
  readonly costTier: "free" | "freemium" | "paid";
  readonly stability: "stable" | "fragile" | "experimental";
  readonly requiresAuth: boolean;
}

export const FETCH_ERROR_CODES = [
  "blocked",
  "notFound",
  "parseError",
  "timeout",
  "authRequired",
  "networkError",
] as const;

export type FetchErrorCode = (typeof FETCH_ERROR_CODES)[number];

export class FetchError extends Error {
  readonly code: FetchErrorCode;
  readonly source: string;
  readonly url?: string;

  constructor(
    code: FetchErrorCode,
    source: string,
    message: string,
    url?: string
  ) {
    super(message);
    this.name = "FetchError";
    this.code = code;
    this.source = source;
    this.url = url;
  }
}
