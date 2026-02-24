import { load } from "cheerio";
import type { ScrapedEvent } from "../fetcher";

function mapEventType(label: string): ScrapedEvent["eventType"] | null {
  const lower = label.toLowerCase();
  if (lower.includes("listed for rent")) return "listedForRent";
  if (lower.includes("listed for sale") || lower === "listed") return "listed";
  if (
    lower.includes("pendingtoactive") ||
    lower.includes("pending to active") ||
    lower.includes("back on market")
  )
    return "active";
  if (lower.includes("pending")) return "pending";
  if (lower.includes("price change") || lower.includes("price reduced"))
    return "priceChange";
  if (lower.includes("sold")) return "sold";
  if (lower.includes("listing removed") || lower.includes("delisted"))
    return "listingRemoved";
  return null;
}

function slugifyAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parsePrice(text: string): number | undefined {
  const digits = text.replace(/[^0-9]/g, "");
  return digits.length > 0 ? Number(digits) : undefined;
}

/** Fetch price history events from Trulia via HTML scraping. */
export async function fetchTruliaHistory(
  address: string
): Promise<ScrapedEvent[]> {
  const slug = slugifyAddress(address);
  const url = `https://www.trulia.com/home/${slug}/`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Trulia fetch error ${response.status} for: ${url}`);
  }

  const html = await response.text();
  const $ = load(html);
  const events: ScrapedEvent[] = [];

  // Try multiple selectors — Trulia's markup can vary
  const rowSelector = [
    "[data-testid='price-history-table'] tr",
    "[class*='PriceHistory'] tr",
    "[class*='priceHistory'] tr",
    "table tr",
  ].join(", ");

  $(rowSelector).each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 2) return;

    const dateText = $(cells[0]).text().trim();
    const eventText = $(cells[1]).text().trim();
    const priceText = cells.length >= 3 ? $(cells[2]).text().trim() : "";

    if (!dateText || !eventText) return;

    const dateParsed = new Date(dateText);
    if (isNaN(dateParsed.getTime())) return;

    const date = dateParsed.toISOString().split("T")[0];
    const eventType = mapEventType(eventText);
    if (!eventType) return;

    events.push({
      date,
      eventType,
      price: priceText ? parsePrice(priceText) : undefined,
    });
  });

  return events;
}
