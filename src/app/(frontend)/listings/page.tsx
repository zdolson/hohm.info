import type { Metadata } from "next";
import Link from "next/link";
import { getPayload } from "@/lib/payload";
import type { Listing, Tag } from "@/payload-types";

const LIMIT = 10;

type Props = {
  searchParams: Promise<{ tag?: string; page?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { tag } = await searchParams;
  const title = tag ? `Listings: ${tag} | hohm.info` : "Listings | hohm.info";
  return { title };
}

function TagChip({ tag }: { tag: Tag }) {
  return (
    <Link
      href={`/listings?tag=${encodeURIComponent(tag.slug)}`}
      className="rounded bg-stone-200 px-2 py-0.5 text-sm text-stone-700 hover:bg-stone-300"
    >
      {tag.name}
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

  const { docs, totalPages, page: currentPage, hasNextPage, hasPrevPage } = result;
  const current = currentPage ?? page;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-stone-900">
        {tagSlug ? `Listings: ${tagSlug}` : "Listings"}
      </h1>
      {tagSlug && (
        <p className="mt-1 text-stone-600">
          <Link href="/listings" className="hover:underline">
            Clear filter
          </Link>
        </p>
      )}
      <ul className="mt-6 space-y-4">
        {docs.map((listing: Listing) => (
          <li key={listing.id} className="rounded border border-stone-200 bg-white p-4 shadow-sm">
            <Link href={`/listings/${listing.slug}`} className="block hover:opacity-90">
              <h2 className="font-semibold text-stone-900">{listing.title}</h2>
              {(listing.address || listing.city || listing.state) && (
                <p className="mt-1 text-sm text-stone-600">
                  [{(listing.address && `${listing.address}, `) ?? ""}
                  {[listing.city, listing.state].filter(Boolean).join(", ")}]
                </p>
              )}
              {(listing.interior?.bedrooms != null ||
                listing.interior?.bathroomsFull != null ||
                listing.price != null) && (
                <p className="mt-1 text-sm text-stone-500">
                  {[
                    listing.interior?.bedrooms != null && `${listing.interior.bedrooms} bed`,
                    listing.interior?.bathroomsFull != null &&
                      `${listing.interior.bathroomsFull} bath`,
                    listing.price != null && `$${listing.price.toLocaleString()}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </Link>
            {listing.tags && listing.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {listing.tags.filter(isTag).map((t) => (
                  <TagChip key={t.id} tag={t} />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {(hasPrevPage || hasNextPage) && (
        <nav className="mt-6 flex gap-4" aria-label="Pagination">
          {hasPrevPage && (
            <Link
              href={
                tagSlug
                  ? `/listings?tag=${encodeURIComponent(tagSlug)}&page=${current - 1}`
                  : `/listings?page=${current - 1}`
              }
              className="text-stone-600 hover:underline"
            >
              Previous
            </Link>
          )}
          <span className="text-stone-500">
            Page {current} of {totalPages}
          </span>
          {hasNextPage && (
            <Link
              href={
                tagSlug
                  ? `/listings?tag=${encodeURIComponent(tagSlug)}&page=${current + 1}`
                  : `/listings?page=${current + 1}`
              }
              className="text-stone-600 hover:underline"
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
