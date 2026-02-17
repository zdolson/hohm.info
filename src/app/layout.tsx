import type { Metadata } from "next";

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
      <body>{children}</body>
    </html>
  );
}
