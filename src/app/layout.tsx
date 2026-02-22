import type { Metadata } from "next";
import Link from "next/link";
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
      <body className="min-h-screen bg-stone-50 text-stone-900">
        <nav className="border-b border-stone-200 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-4xl gap-4">
            <Link href="/" className="font-semibold text-stone-900 hover:underline">
              Home
            </Link>
            <Link href="/listings" className="text-stone-600 hover:underline">
              Listings
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
