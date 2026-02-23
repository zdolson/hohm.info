import type { Metadata } from "next";
import Link from "next/link";
import { propertyTypeOptions, statusOptions } from "@/collections/Listings";
import { getPayload } from "@/lib/payload";
import {
  parseListingsSearchParams,
  buildListingsWhere,
  buildListingsUrl,
  type ParsedListingsSearchParams,
} from "@/lib/search";
import type { Listing, Tag } from "@/payload-types";
import * as Card from "@/components/ui/card";
import { Badge, Button, Heading, Text } from "@/components/ui";
import { css } from "styled-system/css";
import FilterInput from "@/components/Filter/FilterInput";
import FilterSelect from "@/components/Filter/FilterSelect";

const LIMIT = 10;

/** Strict null + undefined check for Payload's `T | null | undefined` fields. */
function isPresent<T>(v: T | null | undefined): v is T {
  return v !== null && v !== undefined;
}

const PROPERTY_TYPE_OPTIONS = [
  { value: "", label: "Any" },
  ...propertyTypeOptions.map((o) => ({ value: o.value, label: o.label })),
] as const;
const STATUS_OPTIONS = [
  { value: "", label: "Any" },
  ...statusOptions.map((o) => ({ value: o.value, label: o.label })),
] as const;

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const raw = await searchParams;
  const flat = toFlatRecord(raw);
  const parsed = parseListingsSearchParams(flat);
  const title = parsed.tags?.length
    ? `Listings: ${parsed.tags.join(", ")} | hohm.info`
    : "Listings | hohm.info";
  return { title };
}

function toFlatRecord(
  raw: Record<string, string | string[] | undefined>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = k === "tags" ? v : Array.isArray(v) ? v[0] : v;
  }
  return out;
}

function TagChip({
  tag,
  currentParams,
}: {
  tag: Tag;
  currentParams: ParsedListingsSearchParams;
}) {
  const current = currentParams.tags ?? [];
  const tags = current.includes(tag.slug) ? current : [...current, tag.slug];
  const url = buildListingsUrl({ ...currentParams, tags, page: 1 });
  return (
    <Link href={url}>
      <Badge
        size="sm"
        variant="subtle"
        className={css({
          _hover: { bg: "gray.4" },
          cursor: "pointer",
        })}
      >
        {tag.name}
      </Badge>
    </Link>
  );
}

function isTag(t: number | Tag): t is Tag {
  return typeof t === "object" && t !== null && "slug" in t;
}

/* ── Filter form ─────────────────────────────────────────────────── */

function ListingsFilterForm({
  params,
}: {
  params: ParsedListingsSearchParams;
}) {
  return (
    <form
      method="get"
      action="/listings"
      className={css({
        mb: "6",
        p: "4",
        rounded: "sm",
        borderWidth: "1px",
        borderColor: "gray.6",
        bg: "gray.2",
        display: "flex",
        flexWrap: "wrap",
        gap: "3",
        alignItems: "flex-end",
      })}
    >
      <input type="hidden" name="page" value="1" />
      <FilterInput
        label="Tags"
        type="text"
        name="tags"
        defaultValue={params.tags?.join(",") ?? ""}
        placeholder="slug,slug"
      />
      <FilterInput
        label="Beds (min)"
        type="number"
        name="bedrooms"
        min={0}
        defaultValue={params.bedrooms ?? ""}
        w="16"
      />
      <FilterInput
        label="Baths (min)"
        type="number"
        name="bathroomsFull"
        min={0}
        defaultValue={params.bathroomsFull ?? ""}
        w="16"
      />
      <FilterInput
        label="Sq ft min"
        type="number"
        name="squareFootageMin"
        min={0}
        defaultValue={params.squareFootageMin ?? ""}
        w="20"
      />
      <FilterInput
        label="Sq ft max"
        type="number"
        name="squareFootageMax"
        min={0}
        defaultValue={params.squareFootageMax ?? ""}
        w="20"
      />
      <FilterInput
        label="Garage (min)"
        type="number"
        name="garageSpaces"
        min={0}
        defaultValue={params.garageSpaces ?? ""}
        w="14"
      />
      <FilterSelect
        label="Type"
        name="propertyType"
        defaultValue={params.propertyType ?? ""}
        options={PROPERTY_TYPE_OPTIONS}
      />
      <FilterSelect
        label="Status"
        name="status"
        defaultValue={params.status ?? ""}
        options={STATUS_OPTIONS}
      />
      <FilterInput
        label="State"
        type="text"
        name="state"
        defaultValue={params.state ?? ""}
        placeholder="e.g. MI"
        w="16"
      />
      <FilterInput
        label="City"
        type="text"
        name="city"
        defaultValue={params.city ?? ""}
        placeholder="e.g. Grand Rapids"
        w="32"
      />
      <FilterInput
        label="Address"
        type="text"
        name="address"
        defaultValue={params.address ?? ""}
        placeholder="contains"
        w="40"
      />
      <Button type="submit" size="sm">
        Apply filters
      </Button>
      <Link href="/listings" className={css({ alignSelf: "center" })}>
        <Button type="button" size="sm" variant="outline">
          Clear
        </Button>
      </Link>
    </form>
  );
}

/* ── Page ─────────────────────────────────────────────────────────── */

export default async function ListingsPage({ searchParams }: Props) {
  const payload = await getPayload();
  const raw = await searchParams;
  const flat = toFlatRecord(raw);
  const parsed = parseListingsSearchParams(flat);
  const page = parsed.page ?? 1;

  let tagIds: number[] | undefined;
  if (parsed.tags?.length) {
    const tagResult = await payload.find({
      collection: "tags",
      where: { slug: { in: parsed.tags } },
      limit: parsed.tags.length,
      depth: 0,
    });
    tagIds = tagResult.docs.map((d) => d.id);
  }

  const where = buildListingsWhere({
    ...parsed,
    tagIds,
  });

  const result = await payload.find({
    collection: "listings",
    depth: 1,
    limit: LIMIT,
    page,
    where: where as Parameters<typeof payload.find>[0]["where"],
    sort: "-updatedAt",
  });

  const {
    docs,
    totalPages,
    page: currentPage,
    hasNextPage,
    hasPrevPage,
  } = result;
  const current = currentPage ?? page;

  return (
    <main
      className={css({
        maxW: "4xl",
        mx: "auto",
        px: "4",
        py: "8",
      })}
    >
      <Heading
        className={css({
          fontSize: "2xl",
          fontWeight: "bold",
          color: "fg.default",
        })}
      >
        {parsed.tags?.length
          ? `Listings: ${parsed.tags.join(", ")}`
          : "Listings"}
      </Heading>
      <ListingsFilterForm params={parsed} />
      <ul
        className={css({
          display: "flex",
          flexDir: "column",
          gap: "4",
        })}
      >
        {docs.map((listing: Listing) => (
          <li key={listing.id}>
            <Card.Root
              className={css({
                rounded: "sm",
                borderWidth: "1px",
                borderColor: "gray.6",
                bg: "gray.2",
                p: "4",
                shadow: "sm",
              })}
            >
              <Link
                href={`/listings/${listing.slug}`}
                className={css({ display: "block", _hover: { opacity: 0.9 } })}
              >
                <Card.Header>
                  <Card.Title>
                    <Heading
                      className={css({
                        fontSize: "md",
                        fontWeight: "semibold",
                        color: "fg.default",
                      })}
                    >
                      {listing.title}
                    </Heading>
                  </Card.Title>
                </Card.Header>
                <Card.Body className={css({ pt: "1" })}>
                  {(listing.address || listing.city || listing.state) && (
                    <Text
                      className={css({ fontSize: "sm", color: "fg.muted" })}
                    >
                      [{(listing.address && `${listing.address}, `) ?? ""}
                      {[listing.city, listing.state].filter(Boolean).join(", ")}
                      ]
                    </Text>
                  )}
                  {(isPresent(listing.interior?.bedrooms) ||
                    isPresent(listing.interior?.bathroomsFull) ||
                    isPresent(listing.price)) && (
                    <Text
                      className={css({
                        mt: "1",
                        fontSize: "sm",
                        color: "fg.subtle",
                      })}
                    >
                      {[
                        isPresent(listing.interior?.bedrooms) &&
                          `${listing.interior.bedrooms} bed`,
                        isPresent(listing.interior?.bathroomsFull) &&
                          `${listing.interior.bathroomsFull} bath`,
                        isPresent(listing.price) &&
                          `$${listing.price.toLocaleString()}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  )}
                </Card.Body>
              </Link>
              {listing.tags && listing.tags.length > 0 && (
                <div
                  className={css({
                    mt: "2",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "1",
                  })}
                >
                  {listing.tags.filter(isTag).map((t) => (
                    <TagChip key={t.id} tag={t} currentParams={parsed} />
                  ))}
                </div>
              )}
            </Card.Root>
          </li>
        ))}
      </ul>
      {(hasPrevPage || hasNextPage) && (
        <nav
          className={css({
            mt: "6",
            display: "flex",
            gap: "4",
            alignItems: "center",
          })}
          aria-label="Pagination"
        >
          {hasPrevPage && (
            <Link
              href={buildListingsUrl(parsed, { page: current - 1 })}
              className={css({
                color: "fg.muted",
                _hover: { textDecoration: "underline" },
              })}
            >
              Previous
            </Link>
          )}
          <Text className={css({ color: "fg.subtle" })}>
            Page {current} of {totalPages}
          </Text>
          {hasNextPage && (
            <Link
              href={buildListingsUrl(parsed, { page: current + 1 })}
              className={css({
                color: "fg.muted",
                _hover: { textDecoration: "underline" },
              })}
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
