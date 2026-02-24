import type { ScrapedProperty, ScrapedEvent } from "../fetcher";

const ACTOR = "maxcopell~zillow-scraper";
const APIFY_BASE = "https://api.apify.com/v2";

function mapEventType(label: string): ScrapedEvent["eventType"] | null {
  const lower = label.toLowerCase();
  if (lower.includes("listed for rent")) return "listedForRent";
  if (lower.includes("listed for sale") || lower.includes("listed"))
    return "listed";
  if (lower.includes("price change") || lower.includes("price reduced"))
    return "priceChange";
  if (lower.includes("back on market")) return "active";
  if (lower.includes("pending")) return "pending";
  if (lower.includes("sold")) return "sold";
  if (lower.includes("listing removed") || lower.includes("delisted"))
    return "listingRemoved";
  return null;
}

function mapPropertyType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("single") || t.includes("house")) return "singleFamily";
  if (t.includes("condo") || t.includes("apartment")) return "condo";
  if (t.includes("townhouse") || t.includes("townhome")) return "townhouse";
  if (t.includes("multi") || t.includes("duplex") || t.includes("triplex"))
    return "multiFamily";
  if (t.includes("land") || t.includes("lot")) return "land";
  if (t.includes("mobile") || t.includes("manufactured")) return "mobileHome";
  return "singleFamily";
}

function mapStatus(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("active") || s.includes("for sale")) return "active";
  if (s.includes("pending") || s.includes("contingent")) return "pending";
  if (s.includes("sold")) return "sold";
  return "offMarket";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapZillowResult(data: any): ScrapedProperty {
  const rawAttributes: string[] = [];
  for (const field of [
    "Heating",
    "Flooring",
    "RoofType",
    "Foundation",
    "Exterior",
    "Sewer",
  ]) {
    if (data[field]) rawAttributes.push(String(data[field]));
  }

  const listingEvents: ScrapedEvent[] = [];
   
  if (Array.isArray(data.PriceHistory)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const ev of data.PriceHistory as any[]) {
      const label = ev.event || ev.priceChangeType || ev.eventType || "";
      const eventType = mapEventType(label);
      if (!eventType) continue;
      const rawDate = ev.date ?? "";
      listingEvents.push({
        date: rawDate.includes("T") ? rawDate.split("T")[0] : rawDate,
        eventType,
        price: typeof ev.price === "number" ? ev.price : undefined,
        source: ev.source || ev.priceSource || undefined,
        mlsNumber: ev.mlsId || data.MlsId || undefined,
      });
    }
  }

  return {
    title: data.StreetAddress || data.streetAddress || undefined,
    address: data.StreetAddress || data.streetAddress || data.address || "",
    city: data.City || data.city || "",
    state: data.State || data.state || "",
    zipCode: data.PostalCode || data.postalCode || data.zipCode || undefined,
    yearBuilt: data.YearBuilt ? Number(data.YearBuilt) : undefined,
    price: data.Price ? Number(data.Price) : undefined,
    beds: data.Bedrooms ? Number(data.Bedrooms) : undefined,
    bathsFull: data.BathroomsFull ? Number(data.BathroomsFull) : undefined,
    bathsHalf: data.BathroomsHalf ? Number(data.BathroomsHalf) : undefined,
    sqft: data.LivingArea ? Number(data.LivingArea) : undefined,
    lotSize: data.LotAreaValue ? Number(data.LotAreaValue) : undefined,
    stories: data.Stories ? Number(data.Stories) : undefined,
    propertyType: data.HomeType
      ? mapPropertyType(String(data.HomeType))
      : undefined,
    status: data.HomeStatus ? mapStatus(String(data.HomeStatus)) : undefined,
    garageSpaces: data.GarageSpaces ? Number(data.GarageSpaces) : undefined,
    fireplaces: data.Fireplaces ? Number(data.Fireplaces) : undefined,
    listingEvents,
    rawAttributes,
    sourceUrl: data.url || data.hdpUrl || data.detailUrl || undefined,
  };
}

/** Fetch property data from Zillow via Apify actor (maxcopell/zillow-scraper). */
export async function fetchZillow(address: string): Promise<ScrapedProperty> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN env var is not set");

  const encodedAddress = encodeURIComponent(address.replace(/\s+/g, "-"));
  const searchUrl = `https://www.zillow.com/homes/${encodedAddress}_rb/`;

  const response = await fetch(
    `${APIFY_BASE}/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=60`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchUrls: [{ url: searchUrl }],
        maxItems: 1,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Apify error ${response.status}: ${text}`);
  }

  const results = (await response.json()) as unknown[];
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(`No Zillow results for: ${address}`);
  }

  return mapZillowResult(results[0]);
}
