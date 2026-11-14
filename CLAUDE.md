# ServiceStart — Agent Guide

CLAUDE GENERATED.

Multi-tenant nonprofit management platform (volunteers, events, members, media, newsletters). One codebase + one set of infrastructure serves many nonprofits; each is an `organizations` row, and per-deployment customization happens through DB config rows rather than branches or forks.

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before making design decisions — it explains _why_ the project is shaped this way, and how the code is split into `core/` and `features/`. [`docs/GLOSSARY.md`](docs/GLOSSARY.md) defines the terms to use in code and copy. [`docs/DB_INFRA.md`](docs/DB_INFRA.md) covers migrations and preview databases.

## Stack

Next.js (App Router) · React 19 · TypeScript · Hono (API + typed RPC client) · Drizzle ORM · PostgreSQL · BetterAuth · Zod · Tailwind v4 · Vitest + Playwright · pnpm · Netlify.

## Layer Map — where to make a change

Code is organized by feature. **`core/`** is what every feature shares and never imports a feature; **`features/<context>/`** is one bounded context (membership, events, forms, communications, media, dashboard, navigation) with all of its code, from tables to components. Requests flow: **`app/` page → a context's `api/` route → its `services/` → Drizzle (`core/db`) → Postgres.**

| Directory             | What lives here                                                                                                                                                                                                                    | Touch it when…                                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `app/`                | Next.js routes only. Pages are **server components** by default; they auth-check, fetch via services, and pass plain data to client components. Pages are composition code and may import any context's internals.                 | Adding/changing a page, route-level access control, or SSR data loading.                                                    |
| `core/`               | Shared infrastructure: `db/` (client and schema barrel), `auth/` (BetterAuth, guards), `tenant/` (finding the org), `config/` (`OrganizationConfigService`), `api/` (RPC client, typed errors), `files/`, `email/`, `utils/`.      | Changing something every feature uses. Never import a feature from here.                                                    |
| `features/<context>/` | One context: `index.ts`, `server.ts`, and `ui.ts` (its public API), `schema.ts` (tables), `config.ts` (config keys), `api/` (Hono sub-apps), `services/`, `components/`, `widgets/`, `lib/` (pure logic, Zod contracts), `hooks/`. | Any feature work. Other contexts import only its public API.                                                                |
| `features/app.ts`     | The only Hono root: every sub-app's `.route()` mount.                                                                                                                                                                              | Adding a new sub-app.                                                                                                       |
| `components/`         | Shared UI with no feature logic: `theme/` (themed wrappers), icons, `SaveBanner`, `TagInput`.                                                                                                                                      | A primitive more than one feature uses.                                                                                     |
| `components/bog/`     | **Generated** BoG Design System primitives (`BogButton`, `BogTable`, …), vendored via `bog-cli` and tracked in `bog.json`, with their support code in `utils/design-system/`. ESLint-ignored.                                      | Never hand-edit. Add a component with the BoG CLI; if a primitive needs behavior it doesn't have, wrap it in `components/`. |
| `drizzle/`            | **Generated** SQL migrations.                                                                                                                                                                                                      | Never hand-write; see Database below.                                                                                       |
| `tests/unit/`         | Vitest (`*.test.ts[x]`), run against a real test Postgres. Mirrors the source folders (`tests/unit/features/forms/...`).                                                                                                           | Services, API routes, hooks, pure utils.                                                                                    |
| `tests/e2e/`          | Playwright (`*.spec.ts`).                                                                                                                                                                                                          | User-visible flows across pages.                                                                                            |
| `scripts/`            | `tsx` scripts for seeding and one-time setup (org, Juno, file storage).                                                                                                                                                            | Local/dev setup or seed data.                                                                                               |
| `juno/`               | Git **submodule** — BoG's shared file/email infra.                                                                                                                                                                                 | Never edit; it's a separate repo.                                                                                           |
| `styles/globals.css`  | Tailwind v4 `@theme` — design tokens (colors, type scale, breakpoints).                                                                                                                                                            | Adding a color or token, rather than hardcoding a hex value.                                                                |

A file that doesn't fit goes in the context that owns its data; add it to the table in `docs/ARCHITECTURE.md`. A dashboard widget lives in the context whose data it shows.

## Boundaries (enforced by `pnpm lint`)

- **A context imports another only through its public API:** `@/features/<context>` (`index.ts`: enums, types, Zod contracts, pure logic, hooks), `@/features/<context>/server` (`server.ts`: services), and `@/features/<context>/ui` (`ui.ts`: components and widgets). Never `@/features/<context>/lib/...` and the like. Inside a context, import its own files directly. When another context needs something new, export it from the right file.
- **`core/` never imports `features/`.** The exceptions are the barrels `core/db/schema.ts` (every context's tables) and `core/config/registry.ts` (every context's config keys), and `import type { AppType }` in the RPC client.
- **Only services, `core/`, `scripts/`, and `tests/` import `@/core/db` or `drizzle-orm`** (type-only `drizzle-orm` imports are fine anywhere, and a context's `schema.ts` defines tables). Everything else calls a service.
- `app/`, `scripts/`, `tests/`, and `features/app.ts` are composition code and may import any context's internals.
- `BOUNDARY_BASELINE` in `eslint.config.mjs` lists files that broke these rules before they existed. Don't add to it; fix the import.

## Multitenancy — the rule that applies to almost every ticket

Every user-facing entity belongs to an organization. Practically:

- **Scope every query by `organizationId`.** Getting a row by ID alone is a tenant-leak bug; services take the org ID and filter on it. Verify the fetched row's `organizationId` matches the caller's active org before returning it.
- The active org comes from `session.session.activeOrganizationId`, or is derived from the request's host subdomain (`getSlugFromHost` in `core/tenant/`). Locally, tenants are subdomains of `lvh.me`.
- **Features are per-org toggles, not per-org code.** Build a feature for everyone, add a boolean config key for it defaulting to off (see **Config keys** below), and enable it with a config row. Never branch the codebase or special-case a nonprofit by name.
- **Enforce the toggle on the server too** — both the page and its API routes. Use `assertFeatureEnabled` in routes and `notFoundIfFeatureDisabled` in server pages (`core/auth/featureGuards.ts`). Hiding a nav item is not access control.
- BetterAuth is customized so one email can exist across multiple orgs (see the overrides in `core/auth/authUtils.ts`). Don't assume email is globally unique.

## Patterns to follow

**API routes.** One Hono sub-app per resource in the context's `api/`, chained method-by-method (`new Hono().get(...).post(...)`) — the chaining is what gives the client its types, so don't split the chain into separate statements. Validate every input with `zValidator("json" | "query" | "param", schema)` and read it back with `c.req.valid(...)`.

**Registering a route.** Add a new sub-app to the `.route()` chain in `features/app.ts`, the only Hono root. `app/api/[[...route]]/route.ts` serves it, and the RPC client and tests call it. Keep the chain explicit. A sub-app mounted at `/api/forms` must come before `features/forms/api/forms.ts`, whose admin middleware runs for every `/api/forms/*` route mounted after it.

**Auth in routes.** Prefer the guards in `core/auth/authUtils.ts` — `requireAuth`, `requireMembership`, `requireAdmin` — which throw typed `HTTPException`s from `core/api/errors.ts`. Older routes hand-roll session checks and `c.json({ error }, 401)`; match the helper style in new code and migrate opportunistically. In server pages, use `redirectIfNotMember()` / `redirectIfNotAdmin()`, which redirect rather than throw.

**Client → server calls** go through the typed Hono RPC client: `import api from "@/core/api/client"`, then `api.notifications[":id"].$patch({ param: { id }, json: { read } })`. Don't write raw `fetch` calls to `/api/...` — you lose end-to-end types. (`fetch` is fine for file uploads and external services.)

**Server pages** fetch through services directly, not through the RPC client, and serialize non-JSON values (`Date` → ISO string) before passing them into client components.

**Services** are plain functions collected into one exported object at the bottom of the file. Keep them free of HTTP concerns — no `Context`, no status codes; throw or return `null` and let the route decide the response.

**Schema.** Each context's tables and their enums live in its `schema.ts`; `core/db/schema.ts` re-exports them all with the relations, and services import tables from `@/core/db/schema`. TypeScript enums are the source of truth; `pgEnum` and Zod schemas are derived from them, so add a value in one place. Reuse those enums in validation instead of restating string literals. Config keys are the exception; see below.

**Config keys.** Each key is declared once, in its context's `config.ts`, with `defineConfig({ key, schema, default, visibility })`: a Zod schema for the value, the default for an org with no row (or an invalid one), and who may read it through `GET /api/organizationConfig` (`public` for signed-out pages, `member`, or `admin`). `core/config/registry.ts` collects every context's definitions. Adding a key takes an `OrganizationConfigKey` member and one `defineConfig` entry, and no migration (`organization_config.key` is text). Keep each key one type: strings are stored as is, anything else as JSON, so a schema can't accept both a string and a non-string. Read and write with `OrganizationConfigService.getConfig(orgId, keys)` / `setConfig` on the server, which return each key's own type, and with `useOrganizationConfig(keys)` on the client. Don't hand-write a getter, setter, or query for a key.

**Styling.** Tailwind utility classes with the semantic tokens from `styles/globals.css` (`text-brand-text`, `bg-grey-fill-weak`, …) — avoid raw hex and arbitrary values. `components/bog/` primitives use CSS modules; that's their convention, not the app's.

**Path aliases.** Import with `@/` (e.g. `@/features/events/services/EventService`), not long relative chains.

**Names.** Use the terms in `docs/GLOSSARY.md` in new code (a "response", not a "submission"). Rename existing code only when you're already editing it.

## Database

Each context's schema lives in its `schema.ts`, collected by `core/db/schema.ts` (which `drizzle.config.ts` reads); migrations in `drizzle/` are generated, never written by hand.

```bash
pnpm run db:generate   # after editing a schema.ts
pnpm run db:migrate    # apply to local dev DB
pnpm run db:check      # verify migration consistency (CI runs this)
pnpm run db:view       # Drizzle Studio
pnpm run db:seed
```

CI also auto-generates and commits migrations on push. If a generated migration looks wrong after a merge, delete and regenerate the PR's migration files rather than editing them. The one hand-written migration is Sprint 5's member type backfill (`drizzle/*_backfill_member_types`), made with `drizzle-kit generate --custom`.

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

- Unit tests hit a **real** Postgres, not mocks. Build fixtures with the helpers in `tests/unit/testUtils.ts` (`createOrganization`, `buildTestUser`, `signUpAndGetSession`, `addMember`, …) and call API routes through `testApi` (Hono's `testClient`). A new table also goes in `tests/unit/setup.ts`'s cleanup list.
- Add `// @vitest-environment node` at the top of server-side test files; the default environment is jsdom for component tests.
- New API routes and services get unit tests; new user-facing flows get an e2e test. Cover the multi-tenant case explicitly — a test that data from org A is invisible to org B is the one that catches the bug that matters here.
- CI runs build, lint, format, unit tests, sharded e2e, and migration checks. All must pass.

## Gotchas

- A member's type must be one of their organization's `member_types` rows (a foreign key). Until #336, call `MembersService.ensureBuiltInMemberTypes` before giving a member a type outside `MembersService`.
- `juno/` is a submodule; a fresh clone needs `git submodule update --init --recursive` plus `pnpm run juno:setup`.
- `DB_URL` contains a `<branch>` placeholder that `getDbUrl()` in `core/utils/env.ts` substitutes so PR preview deploys hit their own preview database. Don't remove it from `.env`.
- File storage is pluggable via `FILE_SERVICE_IMPLEMENTATION` (`local` | `juno`) behind the `IFileService` interface in `core/files/` — code against the interface, not a concrete implementation. Juno deletion is not implemented yet.
- `package.json` marks modules side-effect free (`"sideEffects": ["*.css"]`) so client bundles drop unused re-exports from a context's public API. Don't rely on code running just because a module was imported.
- ESLint ignores `components/bog/` and `juno/`; don't "fix" lint errors there.
