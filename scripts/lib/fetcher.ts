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
