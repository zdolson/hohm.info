import type { Metadata } from "next";
import Link from "next/link";
import { getPayload } from "@/lib/payload";
import type { Listing, Tag } from "@/payload-types";
import * as Card from "@/components/ui/card";
import { Badge, Heading, Text } from "@/components/ui";
import { css } from "styled-system/css";

const LIMIT = 10;

type Props = {
  searchParams: Promise<{ tag?: string; page?: string }>;
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const { tag } = await searchParams;
  const title = tag ? `Listings: ${tag} | hohm.info` : "Listings | hohm.info";
  return { title };
}

function TagChip({ tag }: { tag: Tag }) {
  return (
    <Link href={`/listings?tag=${encodeURIComponent(tag.slug)}`}>
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

export default async function ListingsPage({ searchParams }: Props) {
  const payload = await getPayload();
  const { tag: tagSlug, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(String(pageParam), 10) || 1);

  let tagFilter: { tags: { contains: number } } | undefined;
  if (tagSlug) {
    const tagResult = await payload.find({
      collection: "tags",
      where: { slug: { equals: tagSlug } },
      limit: 1,
      depth: 0,
    });
    const tagId = tagResult.docs[0]?.id;
    if (tagId != null) tagFilter = { tags: { contains: tagId } };
  }

  const result = await payload.find({
    collection: "listings",
    depth: 1,
    limit: LIMIT,
    page,
    where: tagFilter,
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
        {tagSlug ? `Listings: ${tagSlug}` : "Listings"}
      </Heading>
      {tagSlug && (
        <Text className={css({ mt: "1", color: "fg.muted" })}>
          <Link
            href="/listings"
            className={css({ _hover: { textDecoration: "underline" } })}
          >
            Clear filter
          </Link>
        </Text>
      )}
      <ul
        className={css({
          mt: "6",
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
                  {(listing.interior?.bedrooms != null ||
                    listing.interior?.bathroomsFull != null ||
                    listing.price != null) && (
                    <Text
                      className={css({
                        mt: "1",
                        fontSize: "sm",
                        color: "fg.subtle",
                      })}
                    >
                      {[
                        listing.interior?.bedrooms != null &&
                          `${listing.interior.bedrooms} bed`,
                        listing.interior?.bathroomsFull != null &&
                          `${listing.interior.bathroomsFull} bath`,
                        listing.price != null &&
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
                    <TagChip key={t.id} tag={t} />
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
              href={
                tagSlug
                  ? `/listings?tag=${encodeURIComponent(tagSlug)}&page=${current - 1}`
                  : `/listings?page=${current - 1}`
              }
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
              href={
                tagSlug
                  ? `/listings?tag=${encodeURIComponent(tagSlug)}&page=${current + 1}`
                  : `/listings?page=${current + 1}`
              }
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
