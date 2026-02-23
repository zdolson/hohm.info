import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPayload } from "@/lib/payload";
import type { Listing, Tag, Media } from "@/payload-types";
import * as Card from "@/components/ui/card";
import { Badge, Heading, Text } from "@/components/ui";
import { css } from "styled-system/css";

type Props = { params: Promise<{ slug: string }> };

function isTag(t: number | Tag): t is Tag {
  return typeof t === "object" && t !== null && "slug" in t;
}

function isMedia(m: number | Media): m is Media {
  return typeof m === "object" && m !== null && "url" in m;
}

const EVENT_LABELS: Record<string, string> = {
  listed: "Listed for Sale",
  priceChange: "Price Change",
  pending: "Pending",
  active: "Back on Market",
  sold: "Sold",
  listedForRent: "Listed for Rent",
  listingRemoved: "Listing Removed",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const payload = await getPayload();
  const result = await payload.find({
    collection: "listings",
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  });
  const listing = result.docs[0];
  if (!listing) return { title: "Listing not found | hohm.info" };
  return {
    title: `${listing.title} | hohm.info`,
    description: listing.summary ?? undefined,
  };
}

export default async function ListingDetailPage({ params }: Props) {
  const { slug } = await params;
  const payload = await getPayload();
  const result = await payload.find({
    collection: "listings",
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
  });
  const listing = result.docs[0] as Listing | undefined;
  if (!listing) notFound();

  const tags = (listing.tags ?? []).filter(isTag);
  const photos = (listing.photos ?? []).filter(isMedia);

  return (
    <main
      className={css({
        maxW: "4xl",
        mx: "auto",
        px: "4",
        py: "8",
      })}
    >
      <Link
        href="/listings"
        className={css({
          color: "fg.muted",
          _hover: { textDecoration: "underline" },
        })}
      >
        ← Listings
      </Link>
      <article className={css({ mt: "4" })}>
        <Heading
          className={css({
            fontSize: "2xl",
            fontWeight: "bold",
            color: "fg.default",
          })}
        >
          {listing.title}
        </Heading>
        {(listing.address || listing.city || listing.state) && (
          <Text className={css({ mt: "1", color: "fg.muted" })}>
            {listing.address}
            {[listing.city, listing.state].filter(Boolean).length > 0 &&
              `, ${[listing.city, listing.state].filter(Boolean).join(", ")}`}
          </Text>
        )}
        {listing.price != null && (
          <Text
            className={css({ mt: "2", fontSize: "lg", fontWeight: "semibold" })}
          >
            ${listing.price.toLocaleString()}
          </Text>
        )}
        {listing.summary && (
          <Text className={css({ mt: "4", color: "fg.default" })}>
            {listing.summary}
          </Text>
        )}

        <div
          className={css({
            mt: "6",
            display: "grid",
            gap: "6",
            gridTemplateColumns: { base: "1fr", sm: "repeat(2, 1fr)" },
          })}
        >
          {listing.location &&
            (listing.location.zipCode || listing.location.county) && (
              <Card.Root
                className={css({
                  p: "4",
                  rounded: "sm",
                  borderWidth: "1px",
                  borderColor: "gray.6",
                  bg: "gray.2",
                })}
              >
                <Card.Header>
                  <Card.Title>
                    <Text
                      className={css({
                        fontSize: "sm",
                        fontWeight: "semibold",
                        color: "fg.subtle",
                        textTransform: "uppercase",
                      })}
                    >
                      Location
                    </Text>
                  </Card.Title>
                </Card.Header>
                <Card.Body>
                  <ul className={css({ mt: "1", color: "fg.default" })}>
                    {listing.location.zipCode && (
                      <li>ZIP: {listing.location.zipCode}</li>
                    )}
                    {listing.location.county && (
                      <li>County: {listing.location.county}</li>
                    )}
                  </ul>
                </Card.Body>
              </Card.Root>
            )}
          {listing.property && (
            <Card.Root
              className={css({
                p: "4",
                rounded: "sm",
                borderWidth: "1px",
                borderColor: "gray.6",
                bg: "gray.2",
              })}
            >
              <Card.Header>
                <Card.Title>
                  <Text
                    className={css({
                      fontSize: "sm",
                      fontWeight: "semibold",
                      color: "fg.subtle",
                      textTransform: "uppercase",
                    })}
                  >
                    Property
                  </Text>
                </Card.Title>
              </Card.Header>
              <Card.Body>
                <ul className={css({ mt: "1", color: "fg.default" })}>
                  {listing.property.propertyType && (
                    <li>Type: {listing.property.propertyType}</li>
                  )}
                  {listing.property.status && (
                    <li>Status: {listing.property.status}</li>
                  )}
                  {listing.property.stories != null && (
                    <li>Stories: {listing.property.stories}</li>
                  )}
                </ul>
              </Card.Body>
            </Card.Root>
          )}
          {listing.interior && (
            <Card.Root
              className={css({
                p: "4",
                rounded: "sm",
                borderWidth: "1px",
                borderColor: "gray.6",
                bg: "gray.2",
              })}
            >
              <Card.Header>
                <Card.Title>
                  <Text
                    className={css({
                      fontSize: "sm",
                      fontWeight: "semibold",
                      color: "fg.subtle",
                      textTransform: "uppercase",
                    })}
                  >
                    Interior
                  </Text>
                </Card.Title>
              </Card.Header>
              <Card.Body>
                <ul className={css({ mt: "1", color: "fg.default" })}>
                  {listing.interior.bedrooms != null && (
                    <li>Bedrooms: {listing.interior.bedrooms}</li>
                  )}
                  {(listing.interior.bathroomsFull != null ||
                    listing.interior.bathroomsHalf != null) && (
                    <li>
                      Baths:{" "}
                      {[
                        listing.interior.bathroomsFull,
                        listing.interior.bathroomsHalf,
                      ]
                        .filter((n) => n != null)
                        .join(" + ")}
                    </li>
                  )}
                  {listing.interior.squareFootage != null && (
                    <li>
                      Sq ft: {listing.interior.squareFootage.toLocaleString()}
                    </li>
                  )}
                  {listing.interior.fireplaces != null &&
                    listing.interior.fireplaces > 0 && (
                      <li>Fireplaces: {listing.interior.fireplaces}</li>
                    )}
                </ul>
              </Card.Body>
            </Card.Root>
          )}
          {listing.lot?.lotSize != null && (
            <Card.Root
              className={css({
                p: "4",
                rounded: "sm",
                borderWidth: "1px",
                borderColor: "gray.6",
                bg: "gray.2",
              })}
            >
              <Card.Header>
                <Card.Title>
                  <Text
                    className={css({
                      fontSize: "sm",
                      fontWeight: "semibold",
                      color: "fg.subtle",
                      textTransform: "uppercase",
                    })}
                  >
                    Lot
                  </Text>
                </Card.Title>
              </Card.Header>
              <Card.Body>
                <Text className={css({ mt: "1", color: "fg.default" })}>
                  Lot size: {listing.lot.lotSize} sq ft
                </Text>
              </Card.Body>
            </Card.Root>
          )}
          {listing.financial &&
            (listing.financial.annualTaxes != null ||
              listing.financial.taxYear != null) && (
              <Card.Root
                className={css({
                  p: "4",
                  rounded: "sm",
                  borderWidth: "1px",
                  borderColor: "gray.6",
                  bg: "gray.2",
                })}
              >
                <Card.Header>
                  <Card.Title>
                    <Text
                      className={css({
                        fontSize: "sm",
                        fontWeight: "semibold",
                        color: "fg.subtle",
                        textTransform: "uppercase",
                      })}
                    >
                      Financial
                    </Text>
                  </Card.Title>
                </Card.Header>
                <Card.Body>
                  <ul className={css({ mt: "1", color: "fg.default" })}>
                    {listing.financial.annualTaxes != null && (
                      <li>
                        Annual taxes: $
                        {listing.financial.annualTaxes.toLocaleString()}
                      </li>
                    )}
                    {listing.financial.taxYear != null && (
                      <li>Tax year: {listing.financial.taxYear}</li>
                    )}
                  </ul>
                </Card.Body>
              </Card.Root>
            )}
        </div>

        {listing.garageSpaces != null && listing.garageSpaces > 0 && (
          <Text className={css({ mt: "4", color: "fg.default" })}>
            Garage: {listing.garageSpaces} space(s)
          </Text>
        )}
        {listing.yearBuilt != null && (
          <Text className={css({ mt: "1", color: "fg.default" })}>
            Year built: {listing.yearBuilt}
          </Text>
        )}

        {listing.listingEvents && listing.listingEvents.length > 0 && (
          <section className={css({ mt: "8" })}>
            <Heading
              className={css({
                fontSize: "lg",
                fontWeight: "semibold",
                color: "fg.default",
              })}
            >
              Listing history
            </Heading>
            <ul
              className={css({
                mt: "2",
                display: "flex",
                flexDir: "column",
                gap: "1",
                borderLeftWidth: "2px",
                borderColor: "gray.6",
                pl: "4",
              })}
            >
              {[...listing.listingEvents]
                .sort(
                  (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                )
                .map((evt, i) => (
                  <li
                    key={i}
                    className={css({ fontSize: "sm", color: "fg.default" })}
                  >
                    <span
                      className={css({
                        fontWeight: "medium",
                        color: "fg.subtle",
                      })}
                    >
                      {new Date(evt.date).toLocaleDateString()}
                    </span>{" "}
                    {EVENT_LABELS[evt.eventType] ?? evt.eventType}
                    {evt.price != null && ` — $${evt.price.toLocaleString()}`}
                  </li>
                ))}
            </ul>
          </section>
        )}

        {photos.length > 0 && (
          <section className={css({ mt: "8" })}>
            <Heading
              className={css({
                fontSize: "lg",
                fontWeight: "semibold",
                color: "fg.default",
              })}
            >
              Photos
            </Heading>
            <ul
              className={css({
                mt: "2",
                display: "flex",
                flexWrap: "wrap",
                gap: "2",
              })}
            >
              {photos.map((photo) => (
                <li key={photo.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url ?? ""}
                    alt={photo.alt ?? listing.title}
                    className={css({
                      maxH: "48",
                      rounded: "sm",
                      objectFit: "cover",
                    })}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {tags.length > 0 && (
          <section className={css({ mt: "8" })}>
            <Heading
              className={css({
                fontSize: "lg",
                fontWeight: "semibold",
                color: "fg.default",
              })}
            >
              Tags
            </Heading>
            <div
              className={css({
                mt: "2",
                display: "flex",
                flexWrap: "wrap",
                gap: "2",
              })}
            >
              {tags.map((tag) => (
                <Link key={tag.id} href={`/tags/${tag.slug}`}>
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
              ))}
            </div>
          </section>
        )}

        {listing.sourceUrl && (
          <Text className={css({ mt: "6" })}>
            <a
              href={listing.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={css({
                color: "fg.muted",
                _hover: { textDecoration: "underline" },
              })}
            >
              View source
            </a>
          </Text>
        )}
      </article>
    </main>
  );
}
