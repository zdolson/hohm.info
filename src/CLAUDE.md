# src
Next.js app + Payload CMS: config, collections, app routes.

## Files
- `payload.config.ts` — Payload config; loads `.env.local` via dotenv, Postgres pool, collections
- `collections/*.ts` — Payload collection defs (Users, etc.)
- `lib/payload.ts` — getPayload() server helper (cached)
- `app/` — Next routes; `(payload)/admin`, `(payload)/api` for Payload
- `payload-types.ts` — generated; run `pnpm generate:types` to refresh

## Patterns
- ESM, path.resolve(process.cwd(), …) / path.dirname for paths
- Env: DATABASE_URL, PAYLOAD_SECRET, NEXT_PUBLIC_SERVER_URL from `.env.local`

## Deps
- dotenv, payload, @payloadcms/db-postgres, sharp, next

## Gotchas
- Use Supabase **Session pooler** URI (IPv4); direct connection is IPv6-only.
- Encode DB password in URL if it contains `@#:/?` etc.
