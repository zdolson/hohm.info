import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPayload } from "@/lib/payload";
import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html";
import type { Tag, Media } from "@/payload-types";

type Props = { params: Promise<{ slug: string }> };

function isMedia(m: number | Media): m is Media {
  return typeof m === "object" && m !== null && "url" in m;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const payload = await getPayload();
  const result = await payload.find({
    collection: "tags",
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
  });
  const tag = result.docs[0];
  if (!tag) return { title: "Tag not found | hohm.info" };
  return {
    title: `${tag.name} | hohm.info`,
    description: tag.description ?? undefined,
  };
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params;
  const payload = await getPayload();
  const result = await payload.find({
    collection: "tags",
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
  });
  const tag = result.docs[0] as Tag | undefined;
  if (!tag) notFound();

  const mediaItems = (tag.media ?? []).filter(isMedia);
  const richHtml =
    tag.content?.root != null
      ? convertLexicalToHTML({ data: tag.content as Parameters<typeof convertLexicalToHTML>[0]["data"] })
      : "";

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/listings" className="text-stone-600 hover:underline">
        ← Listings
      </Link>
      <article className="mt-4">
        <h1 className="text-2xl font-bold text-stone-900">{tag.name}</h1>
        {tag.category && (
          <p className="mt-1 text-sm uppercase tracking-wide text-stone-500">
            {tag.category}
          </p>
        )}
        {tag.description && (
          <p className="mt-4 text-stone-700">{tag.description}</p>
        )}
        {richHtml && (
          <div
            className="prose prose-stone mt-6 max-w-none"
            dangerouslySetInnerHTML={{ __html: richHtml }}
          />
        )}
        {tag.resources && tag.resources.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-stone-900">Resources</h2>
            <ul className="mt-2 space-y-2">
              {tag.resources.map((r, i) => (
                <li key={i}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-600 hover:underline"
                  >
                    {r.label}
                    {r.type && (
                      <span className="ml-1 text-stone-400">({r.type})</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        {mediaItems.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-stone-900">Media</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {mediaItems.map((m) => (
                <li key={m.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.url ?? ""}
                    alt={m.alt ?? tag.name}
                    className="max-h-40 rounded object-cover"
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </main>
  );
}
