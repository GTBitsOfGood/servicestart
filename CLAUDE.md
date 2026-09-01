# ServiceStart — Agent Guide

CLAUDE GENERATED.

Multi-tenant nonprofit management platform (volunteers, events, members, media, newsletters). One codebase + one set of infrastructure serves many nonprofits; each is an `organizations` row, and per-deployment customization happens through DB config rows rather than branches or forks.

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before making design decisions — it explains _why_ the project is shaped this way. [`docs/DB_INFRA.md`](docs/DB_INFRA.md) covers migrations and preview databases.

## Stack

Next.js (App Router) · React 19 · TypeScript · Hono (API + typed RPC client) · Drizzle ORM · PostgreSQL · BetterAuth · Zod · Tailwind v4 · Vitest + Playwright · pnpm · Netlify.

## Layer Map — where to make a change

Requests flow: **`app/` page → `api/` route → `lib/services/` → Drizzle (`lib/schema.ts`) → Postgres.**

| Directory            | What lives here                                                                                                                                       | Touch it when…                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `app/`               | Next.js routes. Pages are **server components** by default; they auth-check, fetch via services, and pass plain data to client components.            | Adding/changing a page, route-level access control, or SSR data loading.                                                    |
| `components/`        | React components, grouped loosely by feature (`events/`, `navigation/`, `notifications/`, `dashboard/`). Client components are marked `"use client"`. | Any UI work.                                                                                                                |
| `components/bog/`    | **Generated** BoG Design System primitives (`BogButton`, `BogTable`, …), vendored via `bog-cli` and tracked in `bog.json`. ESLint-ignored.            | Never hand-edit. Add a component with the BoG CLI; if a primitive needs behavior it doesn't have, wrap it in `components/`. |
| `api/`               | Hono sub-apps, one file per resource. Validation (Zod), auth checks, and orchestration only.                                                          | Adding/changing an HTTP endpoint.                                                                                           |
| `lib/services/`      | All database access and business logic. Plain async functions bundled into an exported object (`export const XService = { … }`).                      | Anything involving a query, a write, or logic shared between a page and an API route.                                       |
| `lib/` (root)        | Cross-cutting infra: `schema.ts`, `db.ts`, `auth.ts`, `authUtils.ts`, `app.ts`, `api.ts`, `errors.ts`, `navbar.ts`, `utils.ts`.                       | Schema changes, auth helpers, nav entries, shared utilities.                                                                |
| `lib/hooks/`         | Client-side React hooks (org config, active org, notification polling).                                                                               | Client state or client-side fetching.                                                                                       |
| `drizzle/`           | **Generated** SQL migrations.                                                                                                                         | Never hand-write; see Database below.                                                                                       |
| `tests/unit/`        | Vitest (`*.test.ts[x]`), run against a real test Postgres.                                                                                            | Services, API routes, hooks, pure utils.                                                                                    |
| `tests/e2e/`         | Playwright (`*.spec.ts`).                                                                                                                             | User-visible flows across pages.                                                                                            |
| `scripts/`           | `tsx` scripts for seeding and one-time setup (org, Juno, file storage).                                                                               | Local/dev setup or seed data.                                                                                               |
| `juno/`              | Git **submodule** — BoG's shared file/email infra.                                                                                                    | Never edit; it's a separate repo.                                                                                           |
| `styles/globals.css` | Tailwind v4 `@theme` — design tokens (colors, type scale, breakpoints).                                                                               | Adding a color or token, rather than hardcoding a hex value.                                                                |

Nothing outside `lib/services/` (and the auth/config plumbing in `lib/`) should import `db` or talk to Drizzle directly.

## Multitenancy — the rule that applies to almost every ticket

Every user-facing entity belongs to an organization. Practically:

- **Scope every query by `organizationId`.** Getting a row by ID alone is a tenant-leak bug; services take the org ID and filter on it. Verify the fetched row's `organizationId` matches the caller's active org before returning it.
- The active org comes from `session.session.activeOrganizationId`, or is derived from the request's host subdomain (`getSlugFromHost`). Locally, tenants are subdomains of `lvh.me`.
- **Features are per-org toggles, not per-org code.** Build a feature for everyone, add an `OrganizationConfigKey` for it defaulting to off, and enable it with a config row. Never branch the codebase or special-case a nonprofit by name.
- **Enforce the toggle on the server too** — both the page and its API routes. Hiding a nav item is not access control.
- BetterAuth is customized so one email can exist across multiple orgs (see the overrides in `lib/authUtils.ts`). Don't assume email is globally unique.

## Patterns to follow

**API routes.** One Hono sub-app per resource in `api/`, chained method-by-method (`new Hono().get(...).post(...)`) — the chaining is what gives the client its types, so don't split the chain into separate statements. Validate every input with `zValidator("json" | "query" | "param", schema)` and read it back with `c.req.valid(...)`.

**Registering a route requires two edits.** New sub-apps must be added to _both_ `lib/app.ts` (used by the typed client and by tests) and `app/api/[[...route]]/route.ts` (the actual Netlify handler). Forgetting the second one produces a route that passes tests and 404s in the browser.

**Auth in routes.** Prefer the guards in `lib/authUtils.ts` — `requireAuth`, `requireMembership`, `requireAdmin` — which throw typed `HTTPException`s from `lib/errors.ts`. Older routes hand-roll session checks and `c.json({ error }, 401)`; match the helper style in new code and migrate opportunistically. In server pages, use `redirectIfNotMember()` / `redirectIfNotAdmin()`, which redirect rather than throw.

**Client → server calls** go through the typed Hono RPC client: `import api from "@/lib/api"`, then `api.notifications[":id"].$patch({ param: { id }, json: { read } })`. Don't write raw `fetch` calls to `/api/...` — you lose end-to-end types. (`fetch` is fine for file uploads and external services.)

**Server pages** fetch through services directly, not through the RPC client, and serialize non-JSON values (`Date` → ISO string) before passing them into client components.

**Services** are plain functions collected into one exported object at the bottom of the file. Keep them free of HTTP concerns — no `Context`, no status codes; throw or return `null` and let the route decide the response.

**Schema.** TypeScript enums in `lib/schema.ts` are the source of truth; `pgEnum` and Zod schemas are derived from them, so add a value in one place. Reuse those enums in validation instead of restating string literals.

**Styling.** Tailwind utility classes with the semantic tokens from `styles/globals.css` (`text-brand-text`, `bg-grey-fill-weak`, …) — avoid raw hex and arbitrary values. `components/bog/` primitives use CSS modules; that's their convention, not the app's.

**Path aliases.** Import with `@/` (e.g. `@/lib/services/EventService`), not long relative chains.

## Database

Schema lives in `lib/schema.ts`; migrations in `drizzle/` are generated, never written by hand.

```bash
pnpm run db:generate   # after editing lib/schema.ts
pnpm run db:migrate    # apply to local dev DB
pnpm run db:check      # verify migration consistency (CI runs this)
pnpm run db:view       # Drizzle Studio
pnpm run db:seed
```

CI also auto-generates and commits migrations on push. If a generated migration looks wrong after a merge, delete and regenerate the PR's migration files rather than editing them.

## Commands

```bash
pnpm dev            # Juno + local DB + Next dev server
pnpm test           # unit tests (starts/stops the test DB on :5433)
pnpm test:e2e       # Playwright
pnpm lint           # zero warnings allowed
pnpm format:fix     # Prettier (a pre-commit hook checks formatting)
```

Docker must be running: the dev and test databases and Juno are all containers.

## Testing expectations

- Unit tests hit a **real** Postgres, not mocks. Build fixtures with the helpers in `tests/unit/testUtils.ts` (`createOrganization`, `buildTestUser`, `signUpAndGetSession`, `addMember`, …) and call API routes through `testApi` (Hono's `testClient`).
- Add `// @vitest-environment node` at the top of server-side test files; the default environment is jsdom for component tests.
- New API routes and services get unit tests; new user-facing flows get an e2e test. Cover the multi-tenant case explicitly — a test that data from org A is invisible to org B is the one that catches the bug that matters here.
- CI runs build, lint, format, unit tests, sharded e2e, and migration checks. All must pass.

## Gotchas

- `lib/app.ts` and `app/api/[[...route]]/route.ts` duplicate the route registration list — keep them in sync.
- `juno/` is a submodule; a fresh clone needs `git submodule update --init --recursive` plus `pnpm run juno:setup`.
- `DB_URL` contains a `<branch>` placeholder that `getDbUrl()` in `lib/db.ts` substitutes so PR preview deploys hit their own preview database. Don't remove it from `.env`.
- File storage is pluggable via `FILE_SERVICE_IMPLEMENTATION` (`local` | `juno`) behind the `IFileService` interface — code against the interface, not a concrete implementation. Juno deletion is not implemented yet.
- ESLint ignores `components/bog/` and `juno/`; don't "fix" lint errors there.
