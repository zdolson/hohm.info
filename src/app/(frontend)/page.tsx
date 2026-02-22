import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-stone-900">hohm.info</h1>
      <p className="mt-2 text-stone-600">
        Home listings with deep tag knowledge. Browse listings and explore tags
        for context on style, systems, hazards, and more.
      </p>
      <Link
        href="/listings"
        className="mt-6 inline-block rounded bg-stone-900 px-4 py-2 text-white hover:bg-stone-800"
      >
        Browse listings
      </Link>
    </main>
  );
}
