# tests
Vitest (unit + integration) and Playwright (e2e).

## Layout
- `unit/` — pure logic, no DB
- `integration/` — Payload API; need `DATABASE_URL` + `PAYLOAD_SECRET` (.env.local). Skip gracefully if missing.
- `e2e/` — Playwright; `pnpm test:e2e`, run `npx playwright install` once

## Integration conventions
- Get Payload via dynamic import of `payload.config` + `getPayload({ config })`.
- Use `overrideAccess: true` for create/delete in tests; test access by passing `overrideAccess: false` and `req`.
- Clean up created docs in `afterAll` (e.g. delete by slug) so runs are idempotent.
