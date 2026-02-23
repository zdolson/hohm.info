# src

Next.js app + Payload CMS: config, collections, app routes.

## Files

- `payload.config.ts` — Payload config; loads `.env.local` via dotenv, Postgres pool, collections. Uses `requireEnv()` for required env. Upload limit: 10MB.
- `instrumentation-client.ts` — Next.js client instrumentation; initializes PostHog (posthog-js) when `NEXT_PUBLIC_POSTHOG_KEY` set. No provider needed.
- `collections/*.ts` — Payload collection defs: Users (role, access), Media, Tags, Listings
- `lib/payload.ts` — getPayload() server helper (cached)
- `lib/access.ts` — shared `isAdmin` (import as `@/lib/access`)
- `lib/validate.ts` — shared validators: `slug`, `safeUrl`, `isValidSlug` (import as `@/lib/validate`)
- `lib/search.ts` — listings URL param parsing: `parseListingsSearchParams`, `buildListingsWhere`, `buildListingsUrl`
- `app/layout.tsx` — Root layout; nav (Home, Listings), imports `globals.css`
- `app/globals.css` — Panda CSS layers (reset, base, tokens, recipes, utilities)
- `app/(payload)/` — Payload admin + API routes
- `app/(frontend)/` — Public routes: `page.tsx` (/), `listings/page.tsx`, `listings/[slug]/page.tsx`, `tags/[slug]/page.tsx`. Server Components; getPayload(), depth: 1 for relations.
- `payload-types.ts` — generated; run `pnpm generate:types` to refresh

## Patterns

- ESM, path.resolve(process.cwd(), …) / path.dirname for paths
- Env: DATABASE_URL, PAYLOAD_SECRET, NEXT_PUBLIC_SERVER_URL from `.env.local`; optional NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST for analytics
- Required env vars: `requireEnv()` in payload.config (throws on missing)
- Shared access + validation: use `@/lib/access`, `@/lib/validate`
- Public pages: fetch in Server Components via getPayload(); notFound() for missing slug

## Deps

- dotenv, payload, @payloadcms/db-postgres, sharp, next, @pandacss/dev, @park-ui/panda-preset, @ark-ui/react, postcss, posthog-js

## Gotchas

- Local dev: DATABASE_URL points to `supabase start` (127.0.0.1:54322). Remote: use Supabase Session pooler URI (IPv4).
- Encode DB password in URL if it contains `@#:/?` etc.
