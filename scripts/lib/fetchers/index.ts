import type {
  FetcherAdapter,
  AdapterMeta,
  ScrapedEvent,
  ScrapedProperty,
} from "../fetcher";
import { ZillowAdapter } from "./zillow";
import { TruliaAdapter } from "./trulia";

// Priority order for scalar field conflicts: index 0 = highest priority
const SOURCE_PRIORITY = ["zillow", "trulia"] as const;

interface RegistryEntry {
  adapter: FetcherAdapter;
  meta: AdapterMeta;
}

const REGISTRY: Record<string, RegistryEntry> = {
  zillow: {
    adapter: new ZillowAdapter(),
    meta: { costTier: "freemium", stability: "stable", requiresAuth: true },
  },
  trulia: {
    adapter: new TruliaAdapter(),
    meta: { costTier: "free", stability: "fragile", requiresAuth: false },
  },
};

export function getAdapter(name: string): FetcherAdapter {
  const entry = REGISTRY[name];
  if (!entry)
    throw new Error(
      `Unknown source: "${name}". Valid: ${Object.keys(REGISTRY).join(", ")}`
    );
  return entry.adapter;
}

export function getAdapterMeta(name: string): AdapterMeta {
  const entry = REGISTRY[name];
  if (!entry)
    throw new Error(
      `Unknown source: "${name}". Valid: ${Object.keys(REGISTRY).join(", ")}`
    );
  return entry.meta;
}

export function resolveAdapters(names: string[]): FetcherAdapter[] {
  return names.map(getAdapter);
}

const SCALAR_FIELDS = [
  "title",
  "address",
  "city",
  "state",
  "zipCode",
  "county",
  "yearBuilt",
  "price",
  "beds",
  "bathsFull",
  "bathsHalf",
  "sqft",
  "lotSize",
  "stories",
  "propertyType",
  "status",
  "garageSpaces",
  "fireplaces",
  "annualTaxes",
  "taxYear",
  "sourceUrl",
  "description",
] as const satisfies ReadonlyArray<keyof ScrapedProperty>;

function dedupeEvents(events: ScrapedEvent[]): ScrapedEvent[] {
  const seen = new Set<string>();
  const out: ScrapedEvent[] = [];
  for (const e of events) {
    const key = `${e.date}:${e.eventType}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(e);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Merge multiple ScrapedProperty results.
 *  Scalars: SOURCE_PRIORITY order, first non-null/non-empty wins.
 *  Arrays: union + deduplicate. */
export function mergeScraped(
  results: Array<{ source: string; data: ScrapedProperty }>
): ScrapedProperty {
  const sorted = [...results].sort((a, b) => {
    const ai = SOURCE_PRIORITY.indexOf(
      a.source as (typeof SOURCE_PRIORITY)[number]
    );
    const bi = SOURCE_PRIORITY.indexOf(
      b.source as (typeof SOURCE_PRIORITY)[number]
    );
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const merged: Partial<ScrapedProperty> = {};

  for (const field of SCALAR_FIELDS) {
    for (const { data } of sorted) {
      const val = data[field];
      if (val !== undefined && val !== null && val !== "") {
        (merged as Record<string, unknown>)[field] = val;
        break;
      }
    }
  }

  merged.listingEvents = dedupeEvents(
    sorted.flatMap((r) => r.data.listingEvents)
  );

  const allAttrs = new Set(sorted.flatMap((r) => r.data.rawAttributes));
  merged.rawAttributes = [...allAttrs];

  const allPhotos = new Set(sorted.flatMap((r) => r.data.photoUrls ?? []));
  merged.photoUrls = [...allPhotos];

  if (
    typeof merged.address !== "string" ||
    typeof merged.city !== "string" ||
    typeof merged.state !== "string"
  ) {
    throw new Error(
      "mergeScraped: no source provided required fields (address, city, state)"
    );
  }
  return merged as ScrapedProperty;
}
