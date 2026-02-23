import type { Metadata } from "next";
import Link from "next/link";
import { css } from "styled-system/css";
import "./globals.css";

export const metadata: Metadata = {
  title: "hohm.info",
  description: "Home listings with deep tag knowledge",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={css({
          minHeight: "screen",
          bg: "bg.canvas",
          color: "fg.default",
        })}
      >
        <nav
          className={css({
            borderBottomWidth: "1px",
            borderColor: "gray.6",
            bg: "gray.2",
            px: "4",
            py: "3",
          })}
        >
          <div
            className={css({
              maxW: "4xl",
              mx: "auto",
              display: "flex",
              gap: "4",
            })}
          >
            <Link
              href="/"
              className={css({
                fontWeight: "semibold",
                color: "fg.default",
                _hover: { textDecoration: "underline" },
              })}
            >
              Home
            </Link>
            <Link
              href="/listings"
              className={css({
                color: "fg.muted",
                _hover: { textDecoration: "underline" },
              })}
            >
              Listings
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
