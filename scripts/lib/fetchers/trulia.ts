import path from "path";
import fs from "fs";
import { load } from "cheerio";
import type { FetcherAdapter, ScrapedEvent, ScrapedProperty } from "../fetcher";
import { FetchError } from "../fetcher";
import { fetchHtml, fetchPageHtml } from "../browser";
import {
  getDebugMode,
  getDebugAddressSlug,
  getAddressDebugDir,
  getDebugDir,
} from "../debug.js";
/** Max photo URLs to extract per listing (was 20; raised so 57+ gallery listings are captured). */
const MAX_PHOTO_URLS = 60;

/* ---------- helpers ---------- */

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

function mapPropertyType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("single") || t.includes("house") || t.includes("residential"))
    return "singleFamily";
  if (t.includes("condo") || t.includes("apartment")) return "condo";
  if (t.includes("townhouse") || t.includes("townhome")) return "townhouse";
  if (t.includes("multi") || t.includes("duplex") || t.includes("triplex"))
    return "multiFamily";
  if (t.includes("land") || t.includes("lot")) return "land";
  if (t.includes("mobile") || t.includes("manufactured")) return "mobileHome";
  return "singleFamily";
}

function mapStatus(text: string): ScrapedProperty["status"] {
  const t = text.toLowerCase();
  if (t.includes("for sale") || t.includes("active")) return "active";
  if (t.includes("pending") || t.includes("contingent")) return "pending";
  if (t.includes("sold") || t.includes("recently sold")) return "sold";
  return "offMarket";
}

function resolveUrl(input: string): string {
  if (input.includes("trulia.com/")) {
    return input.replace(/\/+$/, "");
  }
  console.warn(
    `[WARN]    Trulia works best with the exact URL from the listing page (street-city-state-zip-listingId). Attempting slug-based lookup for: ${input}`
  );
  return `https://www.trulia.com/home/${slugifyAddress(input)}`;
}

type Cheerio = ReturnType<typeof load>;

/* ---------- __NEXT_DATA__ extraction ---------- */

/** Safely traverse a nested object by dot path. */
function getDeep(obj: unknown, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur === null || cur === undefined || typeof cur !== "object")
      return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

/** Recursively search an object tree for a node that looks like Trulia property data. */
function findPropertyNode(
  obj: unknown,
  depth = 0
): Record<string, unknown> | null {
  if (depth > 8 || obj === null || obj === undefined || typeof obj !== "object")
    return null;

  const rec = obj as Record<string, unknown>;
  const hasAddress =
    typeof rec["streetAddress"] === "string" ||
    typeof rec["formattedAddress"] === "string" ||
    typeof rec["address"] === "string";
  const hasNumericData =
    typeof rec["bedrooms"] === "number" ||
    typeof rec["bathrooms"] === "number" ||
    typeof rec["price"] === "number" ||
    typeof rec["beds"] === "number";

  if (hasAddress && hasNumericData) return rec;

  if (typeof rec["location"] === "object" && rec["location"] !== null) {
    const loc = rec["location"] as Record<string, unknown>;
    if (typeof loc["streetAddress"] === "string" && hasNumericData) return rec;
  }

  for (const val of Object.values(rec)) {
    if (typeof val === "object" && val !== null) {
      const found = findPropertyNode(val, depth + 1);
      if (found !== null) return found;
    }
  }
  return null;
}

/** Trulia puts listing data in props.homeDetails (not pageProps). Map that shape to ScrapedProperty. */
function mapTruliaHomeDetails(
  home: Record<string, unknown>,
  url: string
): ScrapedProperty | null {
  const loc =
    typeof home["location"] === "object" && home["location"] !== null
      ? (home["location"] as Record<string, unknown>)
      : null;
  const address =
    str(loc?.["streetAddress"]) ??
    str(loc?.["homeFormattedAddress"]) ??
    str(home["address"]) ??
    "";
  const city = str(loc?.["city"]) ?? "";
  const state = str(loc?.["stateCode"]) ?? str(loc?.["state"]) ?? "";
  const zipCode = str(loc?.["zipCode"]);

  const priceObj = home["price"];
  const price =
    typeof priceObj === "object" && priceObj !== null
      ? num((priceObj as Record<string, unknown>)["price"])
      : num(priceObj);

  const bedsObj = home["bedrooms"];
  const beds =
    typeof bedsObj === "object" && bedsObj !== null
      ? parseFirstInt(
          str((bedsObj as Record<string, unknown>)["formattedValue"]) ??
            str((bedsObj as Record<string, unknown>)["summaryBedrooms"])
        )
      : num(bedsObj);

  const bathsObj = home["bathrooms"];
  let bathsFull: number | undefined;
  let bathsHalf: number | undefined;
  if (typeof bathsObj === "object" && bathsObj !== null) {
    const b = bathsObj as Record<string, unknown>;
    const formatted = str(b["formattedValue"]) ?? str(b["formattedSummary"]);
    if (formatted !== undefined) {
      const fullMatch = formatted.match(/(\d+)\s*full/);
      const halfMatch = formatted.match(/(\d+)\s*half/);
      bathsFull = fullMatch
        ? parseInt(fullMatch[1], 10)
        : parseFirstInt(formatted);
      bathsHalf = halfMatch ? parseInt(halfMatch[1], 10) : undefined;
    }
  } else {
    bathsFull = num(bathsObj);
  }

  const sqftObj = home["floorSpace"];
  const sqft =
    typeof sqftObj === "object" && sqftObj !== null
      ? parseFirstInt(
          str((sqftObj as Record<string, unknown>)["formattedDimension"])
        )
      : num(sqftObj);

  const lotObj = home["lotSize"];
  const lotSize =
    typeof lotObj === "object" && lotObj !== null
      ? parseFirstFloat(
          str((lotObj as Record<string, unknown>)["formattedDimension"])
        )
      : num(lotObj);

  const statusLabel = str(
    (home["currentStatus"] as Record<string, unknown>)?.["label"]
  );
  const status =
    statusLabel !== undefined ? mapStatus(statusLabel) : "offMarket";

  const descObj = home["description"];
  const description =
    typeof descObj === "object" && descObj !== null
      ? str((descObj as Record<string, unknown>)["value"])
      : str(descObj);

  const rawAttributes: string[] = [];
  const features = home["features"];
  if (typeof features === "object" && features !== null) {
    const f = features as Record<string, unknown>;
    const pushAttr = (a: unknown): void => {
      if (typeof a !== "object" || a === null) return;
      const rec = a as Record<string, unknown>;
      const name =
        str(rec["formattedName"]) ??
        (typeof rec["attribute"] === "object" && rec["attribute"] !== null
          ? str((rec["attribute"] as Record<string, unknown>)["formattedName"])
          : undefined);
      if (name !== undefined) rawAttributes.push(name);
    };
    const categories = f["categories"];
    if (Array.isArray(categories)) {
      for (const cat of categories) {
        if (typeof cat !== "object" || cat === null) continue;
        const attrs = (cat as Record<string, unknown>)["attributes"];
        if (Array.isArray(attrs)) for (const a of attrs) pushAttr(a);
      }
    }
    const highlighted = f["highlightedInfoAttributes"];
    if (Array.isArray(highlighted)) {
      for (const h of highlighted) pushAttr(h);
    }
  }

  const photoUrls: string[] = [];
  const media = home["media"];
  const singleUrl = (m: Record<string, unknown>, ...keys: string[]) => {
    for (const k of keys) {
      const v = m[k];
      if (typeof v === "string" && v.startsWith("http")) return v;
      if (typeof v === "object" && v !== null) {
        const u =
          str((v as Record<string, unknown>)["url"]) ??
          str((v as Record<string, unknown>)["large"]) ??
          str((v as Record<string, unknown>)["smallSrc"]);
        if (u !== undefined) return u;
      }
    }
    return undefined;
  };
  if (typeof media === "object" && media !== null) {
    const photos = (media as Record<string, unknown>)["photos"];
    if (Array.isArray(photos)) {
      for (const p of photos) {
        if (typeof p !== "object" || p === null) continue;
        const urlObj = (p as Record<string, unknown>)["url"];
        const u =
          typeof urlObj === "string"
            ? urlObj
            : typeof urlObj === "object" && urlObj !== null
              ? (str((urlObj as Record<string, unknown>)["large"]) ??
                str((urlObj as Record<string, unknown>)["smallSrc"]))
              : undefined;
        if (u !== undefined && u.startsWith("http")) photoUrls.push(u);
        if (photoUrls.length >= MAX_PHOTO_URLS) break;
      }
    }
    if (photoUrls.length === 0) {
      const u =
        singleUrl(
          media as Record<string, unknown>,
          "heroImage",
          "primaryPhoto",
          "coverPhoto",
          "coverImage",
          "image",
          "thumbnail"
        ) ??
        singleUrl(
          home,
          "heroImage",
          "primaryPhoto",
          "coverPhoto",
          "image",
          "thumbnail"
        );
      if (u !== undefined) photoUrls.push(u);
    }
  }
  if (photoUrls.length === 0) {
    const u = singleUrl(
      home,
      "heroImage",
      "primaryPhoto",
      "coverPhoto",
      "image",
      "thumbnail"
    );
    if (u !== undefined) photoUrls.push(u);
  }

  const hasAnyData =
    price !== undefined ||
    beds !== undefined ||
    sqft !== undefined ||
    city.length > 0;
  if (!hasAnyData) return null;

  return {
    address,
    city,
    state,
    zipCode,
    price,
    beds,
    bathsFull,
    bathsHalf,
    sqft,
    lotSize,
    status,
    listingEvents: [],
    rawAttributes,
    sourceUrl: url,
    photoUrls,
    description,
  };
}

function parseFirstInt(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  const m = s.replace(/,/g, "").match(/\d+/);
  return m !== null ? parseInt(m[0], 10) : undefined;
}

function parseFirstFloat(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  const m = s.replace(/,/g, "").match(/[\d.]+/);
  return m !== null ? parseFloat(m[0]) : undefined;
}

/** Extract ScrapedProperty from __NEXT_DATA__ JSON embedded in the page. */
function extractFromNextData(
  html: string,
  url: string
): ScrapedProperty | null {
  const $ = load(html);
  const scriptText = $("#__NEXT_DATA__").html();
  if (scriptText === null || scriptText.length === 0) return null;

  let data: unknown;
  try {
    data = JSON.parse(scriptText);
  } catch {
    return null;
  }

  const props = getDeep(data, "props");
  const pageProps = getDeep(data, "props", "pageProps");
  const statusCode =
    num(getDeep(pageProps, "_page", "statusCode")) ??
    num(getDeep(props, "_page", "statusCode")) ??
    num(getDeep(props, "statusCode"));
  if (statusCode === 404 || statusCode === 410) {
    throw new FetchError(
      "notFound",
      "trulia",
      `Listing not found (${statusCode})`,
      url
    );
  }

  // Trulia uses props.homeDetails (not pageProps)
  const homeDetails = getDeep(data, "props", "homeDetails");
  if (
    homeDetails !== null &&
    homeDetails !== undefined &&
    typeof homeDetails === "object"
  ) {
    const mapped = mapTruliaHomeDetails(
      homeDetails as Record<string, unknown>,
      url
    );
    if (mapped !== null) {
      if (Array.isArray(mapped.photoUrls) && mapped.photoUrls.length === 0) {
        const ogImage = $('meta[property="og:image"]').attr("content");
        if (ogImage !== undefined && ogImage.startsWith("https://")) {
          mapped.photoUrls.push(ogImage);
        }
      }
      if (getDebugMode())
        console.log(
          `[DEBUG]   Extracted data from __NEXT_DATA__ (homeDetails)`
        );
      return mapped;
    }
  }

  // Fallback: generic candidate search
  const candidates = [
    getDeep(pageProps, "home"),
    getDeep(pageProps, "property"),
    getDeep(pageProps, "homeDetails"),
    getDeep(pageProps, "listingDetails"),
    pageProps,
    props,
    data,
  ].filter(Boolean);

  let node: Record<string, unknown> | null = null;
  for (const c of candidates) {
    node = findPropertyNode(c);
    if (node !== null) break;
  }

  if (node === null) {
    const topKeys =
      typeof data === "object" && data !== null
        ? Object.keys(data as object)
        : [];
    const propsKeys =
      typeof props === "object" && props !== null
        ? Object.keys(props as object)
        : [];
    if (getDebugMode())
      console.log(
        `[DEBUG]   __NEXT_DATA__ found but no property node.` +
          ` root=[${topKeys.join(",")}] props=[${propsKeys.join(",")}]`
      );
    return null;
  }

  const loc =
    typeof node["location"] === "object" && node["location"] !== null
      ? (node["location"] as Record<string, unknown>)
      : node;

  const address =
    str(loc["streetAddress"]) ??
    str(loc["formattedAddress"]) ??
    str(node["address"]) ??
    "";
  const city = str(loc["city"]) ?? str(loc["cityName"]) ?? "";
  const state = str(loc["stateCode"]) ?? str(loc["state"]) ?? "";
  const zipCode = str(loc["zipCode"]) ?? str(loc["postalCode"]);

  const price = num(node["price"]) ?? num(getDeep(node, "price", "value"));
  const beds = num(node["bedrooms"]) ?? num(node["beds"]);
  const bathsFull = num(node["bathrooms"]) ?? num(node["bathroomsFull"]);
  const bathsHalf = num(node["bathroomsHalf"]);
  const sqft =
    num(node["floorSpace"]) ?? num(node["livingArea"]) ?? num(node["sqft"]);
  const yearBuilt = num(node["yearBuilt"]);
  const stories = num(node["stories"]);
  const lotSize = num(node["lotSize"]) ?? num(getDeep(node, "lot", "lotSize"));

  const propertyTypeRaw =
    str(node["propertyType"]) ?? str(node["homeType"]) ?? str(node["type"]);
  const propertyType =
    propertyTypeRaw !== undefined
      ? mapPropertyType(propertyTypeRaw)
      : undefined;

  const statusRaw = str(node["listingStatus"]) ?? str(node["status"]) ?? "";
  const status = mapStatus(statusRaw);

  const description =
    str(node["description"]) ??
    str(getDeep(node, "description", "value")) ??
    str(getDeep(node, "description", "text"));

  const rawAttributes: string[] = [];
  const features = node["features"] ?? node["homeFeatures"];
  if (Array.isArray(features)) {
    for (const f of features) {
      if (typeof f === "string") rawAttributes.push(f);
      else if (typeof f === "object" && f !== null) {
        const label =
          str((f as Record<string, unknown>)["formattedName"]) ??
          str((f as Record<string, unknown>)["name"]);
        if (label !== undefined) rawAttributes.push(label);
      }
    }
  }

  const photoUrls: string[] = [];
  const photos = node["photos"] ?? node["media"] ?? node["images"];
  if (Array.isArray(photos)) {
    for (const p of photos) {
      const photoUrl =
        typeof p === "string"
          ? p
          : typeof p === "object" && p !== null
            ? (str((p as Record<string, unknown>)["url"]) ??
              str((p as Record<string, unknown>)["heroImageUrl"]) ??
              str((p as Record<string, unknown>)["mediaUrl"]))
            : undefined;
      if (photoUrl !== undefined && photoUrl.startsWith("https://")) {
        photoUrls.push(photoUrl);
      }
      if (photoUrls.length >= MAX_PHOTO_URLS) break;
    }
  }

  // Also grab og:image as a fallback photo
  if (photoUrls.length === 0) {
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage !== undefined && ogImage.startsWith("https://")) {
      photoUrls.push(ogImage);
    }
  }

  const listingEvents: ScrapedEvent[] = [];
  const history =
    node["priceHistory"] ?? node["listingHistory"] ?? node["history"];
  if (Array.isArray(history)) {
    for (const h of history) {
      if (typeof h !== "object" || h === null) continue;
      const ev = h as Record<string, unknown>;
      const dateStr = str(ev["date"]) ?? str(ev["time"]);
      const eventLabel =
        str(ev["event"]) ?? str(ev["type"]) ?? str(ev["label"]);
      if (dateStr === undefined || eventLabel === undefined) continue;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) continue;
      const eventType = mapEventType(eventLabel);
      if (eventType === null) continue;
      listingEvents.push({
        date: d.toISOString().split("T")[0],
        eventType,
        price: num(ev["price"]),
      });
    }
  }

  const hasAnyData =
    price !== undefined ||
    beds !== undefined ||
    sqft !== undefined ||
    city.length > 0;

  if (!hasAnyData) return null;

  return {
    address,
    city,
    state,
    zipCode,
    price,
    beds,
    bathsFull,
    bathsHalf,
    sqft,
    yearBuilt,
    stories,
    lotSize,
    propertyType,
    status,
    listingEvents,
    rawAttributes,
    sourceUrl: url,
    photoUrls,
    description,
  };
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && !isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.]/g, ""));
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

/* ---------- Cheerio DOM extraction (fallback) ---------- */

function extractFacts(root: Cheerio): Record<string, string> {
  const $ = root;
  const facts: Record<string, string> = {};

  $(
    "section dl dt, [class*='Detail'] dl dt, [class*='detail'] dl dt, main dl dt"
  ).each((_, dt) => {
    const key = $(dt).text().trim().toLowerCase();
    const value = $(dt).next("dd").text().trim();
    if (key && value) facts[key] = value;
  });

  $("section table tr, [class*='Detail'] table tr, main table tr").each(
    (_, tr) => {
      const cells = $(tr).find("td");
      if (cells.length >= 2) {
        const key = $(cells[0]).text().trim().toLowerCase();
        const value = $(cells[1]).text().trim();
        if (key && value && !facts[key]) facts[key] = value;
      }
    }
  );

  $(
    "[data-testid*='detail'] li, [class*='Detail'] li, [class*='detail'] li, [class*='Fact'] li, section li"
  ).each((_, li) => {
    const text = $(li).text().trim();
    const colon = text.indexOf(":");
    if (colon > 0 && colon < 40) {
      const key = text.slice(0, colon).trim().toLowerCase();
      const value = text.slice(colon + 1).trim();
      if (key && value && !facts[key]) facts[key] = value;
    }
  });

  return facts;
}

function extractSummary($: Cheerio): {
  beds?: number;
  bathsFull?: number;
  bathsHalf?: number;
  sqft?: number;
} {
  const parseNum = (t: string): number | undefined => {
    const n = parseInt(t.replace(/[^0-9]/g, ""), 10);
    return isNaN(n) ? undefined : n;
  };

  const bedsText = $("[data-testid='home-summary-beds'], [data-testid*='Beds']")
    .first()
    .text()
    .trim();
  const bathsText = $(
    "[data-testid='home-summary-baths'], [data-testid*='Baths']"
  )
    .first()
    .text()
    .trim();
  const sqftText = $(
    "[data-testid='home-summary-sqft'], [data-testid*='Sqft'], [data-testid*='SquareFeet']"
  )
    .first()
    .text()
    .trim();

  let bathsFull: number | undefined;
  let bathsHalf: number | undefined;
  if (bathsText) {
    const fullMatch = bathsText.match(/(\d+)/);
    if (fullMatch) {
      bathsFull = parseInt(fullMatch[1], 10);
      if (bathsText.includes(".5") || bathsText.toLowerCase().includes("half"))
        bathsHalf = 1;
    }
  }

  const sqft = sqftText
    ? (() => {
        const digits = sqftText.replace(/[^0-9]/g, "");
        return digits.length > 0 ? Number(digits) : undefined;
      })()
    : undefined;

  return { beds: parseNum(bedsText), bathsFull, bathsHalf, sqft };
}

function extractPhotos($: Cheerio): string[] {
  const seen = new Set<string>();
  const add = (photoUrl: string | undefined) => {
    if (
      typeof photoUrl === "string" &&
      photoUrl.startsWith("https://") &&
      !seen.has(photoUrl)
    ) {
      seen.add(photoUrl);
    }
  };

  $('meta[property="og:image"]').each((_, el) => add($(el).attr("content")));

  $(
    '[data-testid*="photo"] picture source, [class*="Gallery"] picture source'
  ).each((_, el) => {
    const srcset = $(el).attr("srcset") ?? "";
    const urls = srcset
      .split(",")
      .map((s) => s.trim().split(" ")[0])
      .filter((u) => u.startsWith("https://"));
    if (urls.length > 0) add(urls[urls.length - 1]);
  });

  $('img[src*="media.trulia.com"], img[src*="trulia-production-res"]').each(
    (_, el) => add($(el).attr("src"))
  );

  return [...seen].slice(0, MAX_PHOTO_URLS);
}

function extractDescription($: Cheerio): string | undefined {
  const selectors = [
    "[data-testid='description-text']",
    "[data-testid='listing-description']",
    "[class*='Description'] p",
    "[class*='description'] p",
  ];
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    if (text.length > 20) return text;
  }
  return undefined;
}

function extractPriceHistory($: Cheerio): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];

  const rowSelector = [
    "[data-testid='price-history-table'] tr",
    "[class*='PriceHistory'] tr",
    "[class*='priceHistory'] tr",
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
    if (eventType === null) return;

    events.push({
      date,
      eventType,
      price: priceText ? parsePrice(priceText) : undefined,
    });
  });

  return events;
}

function extractAddressFromPage(
  $: Cheerio,
  url: string
): { address: string; city: string; state: string; zipCode?: string } {
  const title = $("title").first().text().trim();
  const titleMatch = title.match(
    /^(.+?),\s*(.+?),\s*([A-Z]{2})\s*(\d{5})?\s*(?:\||$)/
  );
  if (titleMatch) {
    return {
      address: titleMatch[1].trim(),
      city: titleMatch[2].trim(),
      state: titleMatch[3].trim(),
      zipCode: titleMatch[4]?.trim(),
    };
  }

  const streetEl = $(
    "[data-testid='home-address-street'], [class*='AddressStreet']"
  )
    .first()
    .text()
    .trim();
  const cityStateEl = $(
    "[data-testid='home-address-citystate'], [class*='AddressCity']"
  )
    .first()
    .text()
    .trim();
  if (streetEl && cityStateEl) {
    const csMatch = cityStateEl.match(/^(.+),\s*([A-Z]{2})\s*(\d{5})?/);
    if (csMatch) {
      return {
        address: streetEl,
        city: csMatch[1].trim(),
        state: csMatch[2],
        zipCode: csMatch[3],
      };
    }
  }

  const slug = url.match(/\/home\/(.+?)(?:\/)?$/)?.[1] ?? "";
  const urlMatch = slug.match(/^(.+?)-([a-z]{2})-(\d{5})(?:-\d+)?$/);
  if (urlMatch) {
    return {
      address: urlMatch[1].replace(/-/g, " "),
      city: "",
      state: urlMatch[2].toUpperCase(),
      zipCode: urlMatch[3],
    };
  }

  return { address: url, city: "", state: "" };
}

/** Parse ScrapedProperty from HTML using cheerio DOM selectors. */
function parseWithCheerio(html: string, url: string): ScrapedProperty | null {
  const $ = load(html);
  const addressParts = extractAddressFromPage($, url);

  const price = (() => {
    const selectors = [
      "[data-testid='property-price']",
      "[class*='PriceLarge']",
      "[class*='price'] [class*='value']",
    ];
    for (const sel of selectors) {
      const p = parsePrice($(sel).first().text().trim());
      if (p !== undefined && p > 1000) return p;
    }
    return undefined;
  })();

  const summary = extractSummary($);

  const hasAnyData =
    price !== undefined ||
    summary.beds !== undefined ||
    summary.sqft !== undefined ||
    addressParts.city.length > 0;

  if (!hasAnyData) return null;

  const facts = extractFacts($);
  const rawAttributes: string[] = [];

  const yearBuilt = facts["year built"]
    ? parseInt(facts["year built"], 10)
    : undefined;
  const stories = facts["stories"] ? parseInt(facts["stories"], 10) : undefined;

  const lotSize = (() => {
    const raw = facts["lot size"] ?? facts["lot"];
    if (raw === undefined) return undefined;
    const match = raw.match(/([\d.,]+)/);
    if (match === null) return undefined;
    const val = parseFloat(match[1].replace(",", ""));
    return isNaN(val) ? undefined : val;
  })();

  const propertyTypeRaw =
    facts["home type"] ?? facts["property type"] ?? facts["type"];
  const propertyType =
    propertyTypeRaw !== undefined
      ? mapPropertyType(propertyTypeRaw)
      : undefined;

  for (const key of [
    "heating",
    "cooling",
    "exterior",
    "parking",
    "pool",
    "foundation",
    "roof",
    "sewer",
    "water",
  ]) {
    if (facts[key] !== undefined) rawAttributes.push(facts[key]);
  }

  const statusText = (
    $("[data-testid='property-status']").first().text() ||
    $("[class*='StatusBadge']").first().text() ||
    $("title").first().text()
  ).toLowerCase();
  const status = mapStatus(statusText);

  const listingEvents = extractPriceHistory($);
  const photoUrls = extractPhotos($);
  const description = extractDescription($);

  return {
    ...addressParts,
    price,
    beds: summary.beds,
    bathsFull: summary.bathsFull,
    bathsHalf: summary.bathsHalf,
    sqft: summary.sqft,
    yearBuilt:
      yearBuilt !== undefined && !isNaN(yearBuilt) ? yearBuilt : undefined,
    stories: stories !== undefined && !isNaN(stories) ? stories : undefined,
    lotSize,
    propertyType,
    status,
    listingEvents,
    rawAttributes,
    sourceUrl: url,
    photoUrls,
    description,
  };
}

/* ---------- main fetch ---------- */

function dumpHtmlForDebug(html: string, url: string, label: string): void {
  if (!getDebugMode()) return;
  try {
    const slug = url
      .replace(/[^a-zA-Z0-9]/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 80);
    const dir =
      getDebugAddressSlug() !== null ? getAddressDebugDir() : getDebugDir();
    fs.mkdirSync(dir, { recursive: true });
    const filePath =
      getDebugAddressSlug() !== null
        ? path.join(dir, `${label}.html`)
        : path.join(dir, `${label}-${slug}.html`);
    fs.writeFileSync(filePath, html);
    console.log(`[DEBUG]   HTML dumped to ${filePath} (${html.length} chars)`);
  } catch {
    // non-critical
  }
}

/** Try parsing HTML: __NEXT_DATA__ first, then cheerio DOM. */
function parseHtml(html: string, url: string): ScrapedProperty | null {
  const fromNext = extractFromNextData(html, url);
  if (fromNext !== null) {
    if (getDebugMode())
      console.log(`[DEBUG]   Extracted data from __NEXT_DATA__`);
    return fromNext;
  }
  return parseWithCheerio(html, url);
}

/** Fetch full property data from Trulia.
 *  Strategy: plain HTTP → __NEXT_DATA__/cheerio → headless browser fallback. */
export async function fetchTrulia(input: string): Promise<ScrapedProperty> {
  const url = resolveUrl(input);

  // Strategy 1: plain HTTP (less detectable)
  try {
    if (getDebugMode()) console.log(`[DEBUG]   Trying plain HTTP fetch...`);
    const html = await fetchHtml(url);
    const httpResult = parseHtml(html, url);
    if (httpResult !== null) return httpResult;
    dumpHtmlForDebug(html, url, "http");
    if (getDebugMode())
      console.log(
        `[DEBUG]   HTTP succeeded but page had no usable data — trying browser`
      );
  } catch (err) {
    const code = err instanceof FetchError ? err.code : "networkError";
    if (getDebugMode())
      console.log(`[DEBUG]   HTTP fetch failed (${code}) — trying browser`);
  }

  // Strategy 2: headless browser with stealth
  let html: string;
  try {
    html = await fetchPageHtml(url, {
      waitForSelector: "[data-testid='home-summary-beds'], title",
      waitForSelectorTimeout: 12_000,
    });
  } catch (err) {
    if (err instanceof FetchError) {
      throw new FetchError(err.code, "trulia", err.message, url);
    }
    const msg = (err as Error).message ?? String(err);
    if (msg.includes("timeout") || msg.includes("ERR_TIMED_OUT")) {
      throw new FetchError("timeout", "trulia", msg, url);
    }
    if (msg.includes("403") || msg.includes("Bot protection")) {
      throw new FetchError("blocked", "trulia", msg, url);
    }
    throw new FetchError("networkError", "trulia", msg, url);
  }

  const result = parseHtml(html, url);
  if (result !== null) return result;

  dumpHtmlForDebug(html, url, "browser");
  throw new FetchError(
    "parseError",
    "trulia",
    "Page returned no usable property data (likely blocked or SPA didn't render). HTML dumped to output/debug/",
    url
  );
}

/** @deprecated Use fetchTrulia() — returns full ScrapedProperty including events */
export async function fetchTruliaHistory(
  address: string
): Promise<ScrapedEvent[]> {
  const scraped = await fetchTrulia(address);
  return scraped.listingEvents;
}

export class TruliaAdapter implements FetcherAdapter {
  readonly name = "trulia";
  fetch(input: string): Promise<ScrapedProperty> {
    return fetchTrulia(input);
  }
}
