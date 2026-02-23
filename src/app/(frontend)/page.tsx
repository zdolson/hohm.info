import Link from "next/link";
import { Heading, Text } from "@/components/ui";
import { css } from "styled-system/css";

export default function HomePage() {
  return (
    <main
      className={css({
        maxW: "4xl",
        mx: "auto",
        px: "4",
        py: "12",
      })}
    >
      <Heading
        className={css({
          fontSize: "3xl",
          fontWeight: "bold",
          color: "fg.default",
        })}
      >
        hohm.info
      </Heading>
      <Text className={css({ mt: "2", color: "fg.muted" })}>
        Home listings with deep tag knowledge. Browse listings and explore tags
        for context on style, systems, hazards, and more.
      </Text>
      <Link
        href="/listings"
        className={css({
          mt: "6",
          display: "inline-block",
          rounded: "sm",
          bg: "ruby.9",
          color: "white",
          px: "4",
          py: "2",
          fontWeight: "medium",
          _hover: { bg: "ruby.10" },
        })}
      >
        Browse listings
      </Link>
    </main>
  );
}
