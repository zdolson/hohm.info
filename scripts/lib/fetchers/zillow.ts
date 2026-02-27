import type { FetcherAdapter, ScrapedProperty, ScrapedEvent } from "../fetcher";

const ACTOR = "maxcopell~zillow-scraper";
const MAX_PHOTO_URLS = 20;

/** Extract photo URLs from Zillow/Apify result; tries several shapes. Dedup, max 20. */
export function extractPhotoUrls(data: unknown): string[] {
  const seen = new Set<string>();
  const add = (url: string | undefined) => {
    if (typeof url === "string" && url.startsWith("http")) {
      seen.add(url);
    }
  };
  const d = data as Record<string, unknown>;

  // 1. data.photos[].url or data.photos[] (string)
  const photos = d?.photos;
  if (Array.isArray(photos)) {
    for (const p of photos) {
      if (typeof p === "string") add(p);
      else if (p && typeof p === "object" && "url" in p)
        add((p as { url: string }).url);
    }
  }
  // 2. carouselPhotos[].url or .mixedSources.jpeg[0].url
  const carousel = d?.carouselPhotos;
  if (Array.isArray(carousel)) {
    for (const c of carousel) {
      if (c && typeof c === "object") {
        const o = c as Record<string, unknown>;
        if (typeof o.url === "string") add(o.url);
        const jpeg = o.mixedSources as { jpeg?: unknown[] } | undefined;
        if (
          Array.isArray(jpeg?.jpeg) &&
          jpeg.jpeg[0] &&
          typeof jpeg.jpeg[0] === "object" &&
          jpeg.jpeg[0] !== null &&
          "url" in jpeg.jpeg[0]
        ) {
          add((jpeg.jpeg[0] as { url: string }).url);
        }
      }
    }
  }
  // 3. data.images[] (string or .url)
  const images = d?.images;
  if (Array.isArray(images)) {
    for (const img of images) {
      if (typeof img === "string") add(img);
      else if (img && typeof img === "object" && "url" in img)
        add((img as { url: string }).url);
    }
  }
  // 4. hiResPicture
  if (typeof d?.hiResPicture === "string") add(d.hiResPicture);
  // 5. miniCardPhotos[].url
  const mini = d?.miniCardPhotos;
  if (Array.isArray(mini)) {
    for (const m of mini) {
      if (m && typeof m === "object" && "url" in m)
        add((m as { url: string }).url);
    }
  }

  return [...seen].slice(0, MAX_PHOTO_URLS);
}

/** Extract listing description from Zillow/Apify result. */
export function extractDescription(data: unknown): string | undefined {
  const d = data as Record<string, unknown>;
  const raw =
    (typeof d?.description === "string" && d.description) ||
    (typeof d?.homeDescription === "string" && d.homeDescription) ||
    (typeof d?.Description === "string" && d.Description);
  return typeof raw === "string" && raw.length > 0 ? raw.trim() : undefined;
}
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
    photoUrls: extractPhotoUrls(data),
    description: extractDescription(data),
  };
}

/** Fetch property data from Zillow via Apify actor (maxcopell/zillow-scraper). */
export async function fetchZillow(address: string): Promise<ScrapedProperty> {
  const token = process.env.APIFY_TOKEN;
  if (!token)
    throw new Error("APIFY_TOKEN not set — set it or use --sources trulia");

  const encodedAddress = encodeURIComponent(address.replace(/\s+/g, "-"));
  const searchUrl = `https://www.zillow.com/homes/${encodedAddress}_rb/`;

  const response = await fetch(
    `${APIFY_BASE}/acts/${ACTOR}/run-sync-get-dataset-items?timeout=60`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
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

export class ZillowAdapter implements FetcherAdapter {
  readonly name = "zillow";
  fetch(input: string): Promise<ScrapedProperty> {
    return fetchZillow(input);
  }
}
