import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPayload } from "@/lib/payload";
import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html";
import type { Tag, Media } from "@/payload-types";
import { Badge, Heading, Text } from "@/components/ui";
import { css } from "styled-system/css";

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
      ? convertLexicalToHTML({
          data: tag.content as Parameters<
            typeof convertLexicalToHTML
          >[0]["data"],
        })
      : "";

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
          {tag.name}
        </Heading>
        {tag.category && (
          <span className={css({ display: "inline-block", mt: "1" })}>
            <Badge
              size="sm"
              variant="subtle"
              className={css({
                textTransform: "uppercase",
                letterSpacing: "wider",
              })}
            >
              {tag.category}
            </Badge>
          </span>
        )}
        {tag.description && (
          <Text className={css({ mt: "4", color: "fg.default" })}>
            {tag.description}
          </Text>
        )}
        {richHtml && (
          <div
            className={css({
              mt: "6",
              maxW: "none",
              "& prose": { color: "fg.default" },
              "& a": {
                color: "fg.muted",
                _hover: { textDecoration: "underline" },
              },
            })}
            dangerouslySetInnerHTML={{ __html: richHtml }}
          />
        )}
        {tag.resources && tag.resources.length > 0 && (
          <section className={css({ mt: "8" })}>
            <Heading
              className={css({
                fontSize: "lg",
                fontWeight: "semibold",
                color: "fg.default",
              })}
            >
              Resources
            </Heading>
            <ul
              className={css({
                mt: "2",
                display: "flex",
                flexDir: "column",
                gap: "2",
              })}
            >
              {tag.resources.map((r, i) => (
                <li key={i}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={css({
                      color: "fg.muted",
                      _hover: { textDecoration: "underline" },
                    })}
                  >
                    {r.label}
                    {r.type && (
                      <span className={css({ ml: "1", color: "fg.subtle" })}>
                        ({r.type})
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        {mediaItems.length > 0 && (
          <section className={css({ mt: "8" })}>
            <Heading
              className={css({
                fontSize: "lg",
                fontWeight: "semibold",
                color: "fg.default",
              })}
            >
              Media
            </Heading>
            <ul
              className={css({
                mt: "2",
                display: "flex",
                flexWrap: "wrap",
                gap: "2",
              })}
            >
              {mediaItems.map((m) => (
                <li key={m.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.url ?? ""}
                    alt={m.alt ?? tag.name}
                    className={css({
                      maxH: "40",
                      rounded: "sm",
                      objectFit: "cover",
                    })}
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
