import Link from "next/link";
import { Heading, Text } from "@/components/ui";
import { css } from "styled-system/css";

export default function NotFound() {
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
          fontSize: "2xl",
          fontWeight: "bold",
          color: "fg.default",
        })}
      >
        Page not found
      </Heading>
      <Text className={css({ mt: "2", color: "fg.muted" })}>
        The page you’re looking for doesn’t exist or was moved.
      </Text>
      <div
        className={css({
          mt: "6",
          display: "flex",
          gap: "4",
        })}
      >
        <Link
          href="/"
          className={css({
            rounded: "sm",
            bg: "ruby.9",
            color: "white",
            px: "4",
            py: "2",
            fontWeight: "medium",
            _hover: { bg: "ruby.10" },
          })}
        >
          Home
        </Link>
        <Link
          href="/listings"
          className={css({
            rounded: "sm",
            borderWidth: "1px",
            borderColor: "gray.6",
            px: "4",
            py: "2",
            fontWeight: "medium",
            _hover: { bg: "gray.3" },
          })}
        >
          Listings
        </Link>
      </div>
    </main>
  );
}
