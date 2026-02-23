# app

Next.js App Router: root layout, global CSS, route groups.

## Files

- `layout.tsx` — Root layout; nav (Home, Listings), Panda css() body/nav styles
- `globals.css` — Panda CSS layer directives
- `(payload)/` — Payload admin + API (layout, api/[...slug], admin/[[...segments]])
- `(frontend)/` — Public pages: /, /listings, /listings/[slug], /tags/[slug]

## Patterns

- Route groups: (payload) and (frontend) don’t affect URL path
- Landing at / is (frontend)/page.tsx
