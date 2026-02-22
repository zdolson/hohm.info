import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPayload } from "@/lib/payload";
import type { Listing, Tag, Media } from "@/payload-types";

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
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/listings" className="text-stone-600 hover:underline">
        ← Listings
      </Link>
      <article className="mt-4">
        <h1 className="text-2xl font-bold text-stone-900">{listing.title}</h1>
        {(listing.address || listing.city || listing.state) && (
          <p className="mt-1 text-stone-600">
            {listing.address}
            {[listing.city, listing.state].filter(Boolean).length > 0 &&
              `, ${[listing.city, listing.state].filter(Boolean).join(", ")}`}
          </p>
        )}
        {listing.price != null && (
          <p className="mt-2 text-lg font-semibold">${listing.price.toLocaleString()}</p>
        )}
        {listing.summary && <p className="mt-4 text-stone-700">{listing.summary}</p>}

        {/* Field groups */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {listing.location && (listing.location.zipCode || listing.location.county) && (
            <section>
              <h2 className="text-sm font-semibold uppercase text-stone-500">Location</h2>
              <ul className="mt-1 text-stone-700">
                {listing.location.zipCode && <li>ZIP: {listing.location.zipCode}</li>}
                {listing.location.county && <li>County: {listing.location.county}</li>}
              </ul>
            </section>
          )}
          {listing.property && (
            <section>
              <h2 className="text-sm font-semibold uppercase text-stone-500">Property</h2>
              <ul className="mt-1 text-stone-700">
                {listing.property.propertyType && (
                  <li>Type: {listing.property.propertyType}</li>
                )}
                {listing.property.status && <li>Status: {listing.property.status}</li>}
                {listing.property.stories != null && (
                  <li>Stories: {listing.property.stories}</li>
                )}
              </ul>
            </section>
          )}
          {listing.interior && (
            <section>
              <h2 className="text-sm font-semibold uppercase text-stone-500">Interior</h2>
              <ul className="mt-1 text-stone-700">
                {listing.interior.bedrooms != null && (
                  <li>Bedrooms: {listing.interior.bedrooms}</li>
                )}
                {(listing.interior.bathroomsFull != null ||
                  listing.interior.bathroomsHalf != null) && (
                  <li>
                    Baths:{" "}
                    {[listing.interior.bathroomsFull, listing.interior.bathroomsHalf]
                      .filter((n) => n != null)
                      .join(" + ")}
                  </li>
                )}
                {listing.interior.squareFootage != null && (
                  <li>Sq ft: {listing.interior.squareFootage.toLocaleString()}</li>
                )}
                {listing.interior.fireplaces != null && listing.interior.fireplaces > 0 && (
                  <li>Fireplaces: {listing.interior.fireplaces}</li>
                )}
              </ul>
            </section>
          )}
          {listing.lot?.lotSize != null && (
            <section>
              <h2 className="text-sm font-semibold uppercase text-stone-500">Lot</h2>
              <p className="mt-1 text-stone-700">Lot size: {listing.lot.lotSize} sq ft</p>
            </section>
          )}
          {listing.financial &&
            (listing.financial.annualTaxes != null || listing.financial.taxYear != null) && (
              <section>
                <h2 className="text-sm font-semibold uppercase text-stone-500">Financial</h2>
                <ul className="mt-1 text-stone-700">
                  {listing.financial.annualTaxes != null && (
                    <li>Annual taxes: ${listing.financial.annualTaxes.toLocaleString()}</li>
                  )}
                  {listing.financial.taxYear != null && (
                    <li>Tax year: {listing.financial.taxYear}</li>
                  )}
                </ul>
              </section>
            )}
        </div>

        {listing.garageSpaces != null && listing.garageSpaces > 0 && (
          <p className="mt-4 text-stone-700">Garage: {listing.garageSpaces} space(s)</p>
        )}
        {listing.yearBuilt != null && (
          <p className="mt-1 text-stone-700">Year built: {listing.yearBuilt}</p>
        )}

        {/* Listing events timeline */}
        {listing.listingEvents && listing.listingEvents.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-stone-900">Listing history</h2>
            <ul className="mt-2 space-y-1 border-l-2 border-stone-200 pl-4">
              {[...listing.listingEvents]
                .sort(
                  (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                )
                .map((evt, i) => (
                  <li key={i} className="text-sm text-stone-700">
                    <span className="font-medium text-stone-500">
                      {new Date(evt.date).toLocaleDateString()}
                    </span>{" "}
                    {EVENT_LABELS[evt.eventType] ?? evt.eventType}
                    {evt.price != null && ` — $${evt.price.toLocaleString()}`}
                  </li>
                ))}
            </ul>
          </section>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-stone-900">Photos</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {photos.map((photo) => (
                <li key={photo.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url ?? ""}
                    alt={photo.alt ?? listing.title}
                    className="max-h-48 rounded object-cover"
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-stone-900">Tags</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/tags/${tag.slug}`}
                  className="rounded bg-stone-200 px-3 py-1 text-sm text-stone-700 hover:bg-stone-300"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {listing.sourceUrl && (
          <p className="mt-6">
            <a
              href={listing.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-600 hover:underline"
            >
              View source
            </a>
          </p>
        )}
      </article>
    </main>
  );
}
