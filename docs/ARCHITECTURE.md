# ServiceStart Architecture

_As of June 2026_

This guide is intended to ease the handoff to the Fall 2026 ServiceStart EM. ServiceStart is a bit of a weird project, so I (Renato, the Spring 2026 EM) wanted to explain the key decisions I made and what they mean for you. If you have questions, hit me up on Slack under Renato Dell'Osso.

## Background: Voluntrack

ServiceStart is intended as a replacement to Voluntrack, Bits of Good's standard nonprofit management web app. Think event management, user tracking, and newsletters. To my knowledge, there are 5 nonprofits currently on Voluntrack, each with a branch of the GitHub repo. Customization for each nonprofit is done via these branches, by directly modifying the codebase. This direct modification means the codebase got fragmented and is frankly a mess. Compounding this is that each nonprofit requires separate infrastructure.

## What is ServiceStart?

ServiceStart is a replacement for Voluntrack meant to alleviate Voluntrack's problems(codebase fragmentation, separate infrastructure, etc). We want a nonprofit management platform that allows for easy deployments and customization while still using a single codebase and one set of infrastructure. Put simply, multitenancy.

The project lies somewhere on the spectrum between "single app" and "component library." ServiceStart is certainly in the middle, but exactly where is debatable. We want future BoG teams to use ServiceStart to make a wide array of applications. However, ServiceStart cannot handle every possible BoG project, nor should it. You wouldn't build ICAN with ServiceStart, for example. Handling every possible project would require us to avoid making opinionated choices and come at the cost of doing those projects well. In my opinion, it's better for us to target certain types of projects (namely projects heavy on data management, editing, and presentation) and have strong opinions about how those projects should be built.

If we took the pure component library route, we would have to build components that do things, but would have no say over _how_ those things are done. Consider a hypothetical member directory component in a universe where we cannot dictate architecture outside of our own components. The member directory first needs to fetch member data, leading to the question of the project implements client-server communication. If we can't dictate architecture, we're forced to support `fetch`, Hono, or even the project's own abstraction. We'd then have to somehow build an API route that can be slotted into whatever API system the project uses (raw Next.js endpoints, Hono, Express, etc). In short, we have to build abstractions and likely inject dependencies for every single interaction between a component itself (the React component and the API routes) and _anything else_ it touches (DB, analytics, auth, etc). Think of it as trying to design Legos that fit together with every other building toy available: we'd degrade the user experience to ensure ServiceStart doesn't tell users how to use ServiceStart.

The above explanation may be a tad hyperbolic, so I'll provide some justification for why we took our "multi-tenant app" approach and not merely why we didn't take the "component library" route. By building a monolithic, multi-tenant platform (multiple projects but one codebase), we avoid having to make the choice between building a "reusable library feature" and a "one project only feature." If you build something in ServiceStart, any other project can use it. Reusability being the default means it doesn't take extra work for a feature to be reusable. Furthermore, because ServiceStart is a single platform, it does dictate the architecture of all its projects. However, this standardization means we don't need an abstraction layer to move between ServiceStart and a project, since ServiceStart and its projects are one and the same.

Hopefully that explanation sufficiently covers why ServiceStart is designed the way it is. We want to quickly build projects from a set of reusable features, and reusability by default means ServiceStart grows as long with its projects.

## How is Multitenancy Implemented?

Each nonprofit or ServiceStart deployment has a row in the `Organizations` table. This row is the central hub for everything in that deployment. To users, these deployments should be totally separate; a ServiceStart app should be indistinguishable from a non-ServiceStart app except for a "Made with ServiceStart" in the footer. To this end, we've modified BetterAuth's behavior to allow one username to be used across multiple organizations.

App customization is done through "organization configurations," chiefly in the `OrganizationConfig` table. There are a variety of options implemented in ServiceStart. Each comes with a default setting, but an `OrganizationConfig` row can be created to override that setting for the specified organization. These settings are cached on the client to speed up non-SSRed pages.

Now, suppose nonprofit A wants a new feature for their ServiceStart app. You'd build this feature as though it existed for every nonprofit, but then add a new option to enable/disable this feature, defaulting it to disabled. Then, you'd create a row in the production DB to enable the feature for nonprofit A. This implementation does mean that technically every nonprofit has some data for most features, but just can't access it.

Suppose that later nonprofit B wants a similar feature. Ordinarily, you'd have to build the feature from scratch despite its similarities to nonprofit A's feature. With ServiceStart, however, you simply add a config option and use that option to determine which version of the feature to present to users. You only have to code the differences between the two features.

Side note: Check whether features are enabled on the relevant API routes. If the user directory is disabled, that feature's API routes should also be disabled. Use `assertFeatureEnabled` in routes and `notFoundIfFeatureDisabled` in server pages (`core/auth/featureGuards.ts`); both make a feature that's off look like it doesn't exist (a 404).

## Folders and boundaries

_Added in Sprint 5 (#333)._

The code is organized around features, not layers. Everything lives in one of two places:

- **`core/`** is what every feature shares: the database client, auth, finding the organization, config, the API plumbing, files, email, and generic utilities. `core/` never imports a feature.
- **`features/<context>/`** is one bounded context: one area of the product, its data, and all of its code, from tables to components. A context's internals are private. Other contexts use only its public API: `index.ts`, `server.ts`, and `ui.ts`.

`app/` stays as Next.js routes only. Pages compose contexts, so they may import any context's internals. `components/` is shared UI with no feature logic: the generated BoG primitives in `components/bog/`, the themed wrappers in `components/theme/`, icons, `SaveBanner`, and `TagInput`. (The BoG CLI also generates `utils/design-system/`, which `components/bog/` imports.)

| Folder                     | What's in it                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/db/`                 | The Drizzle client (`index.ts`), the schema barrel (`schema.ts`), and shared column types (`columns.ts`)                                                                  |
| `core/auth/`               | BetterAuth (`auth.ts`, `authClient.ts`), the route and page guards (`authUtils.ts`, `featureGuards.ts`), the auth pages' components                                       |
| `core/tenant/`             | Organizations and finding the one a request is for (host parsing, `OrganizationService`, `useActiveOrganization`)                                                         |
| `core/config/`             | `organization_config`, `defineConfig` and the key registry, the store, `OrganizationConfigService`, its route and hook, branding and theme                                |
| `core/api/`                | The typed RPC client (`client.ts`), typed errors, `ping`                                                                                                                  |
| `core/files/`              | `FileService` and its local and Juno implementations, serving images                                                                                                      |
| `core/email/`              | `EmailService` and email setup                                                                                                                                            |
| `core/utils/`              | Generic helpers and hooks, and `env.ts`                                                                                                                                   |
| `features/membership/`     | Members, roles, member types, invitations, join requests, profiles, audiences                                                                                             |
| `features/events/`         | Events, shifts, RSVPs, tags, and the events and weekly calendar widgets                                                                                                   |
| `features/forms/`          | Forms, questions, responses, review, information requests, and the forms and application status widgets                                                                   |
| `features/communications/` | Notifications, alerts, announcements, messages, email to members, and the notifications and newsletter widgets                                                            |
| `features/media/`          | The media library                                                                                                                                                         |
| `features/dashboard/`      | The dashboard grid, header, layout schema and builder, the widget registry, the dashboard config keys (`config.ts`), and member types' layouts (`DashboardLayoutService`) |
| `features/navigation/`     | The navbar (`navItems.ts`, `navbarConfig.ts`, `getNavbarItems.ts`), the footer, and the organization logo                                                                 |

A dashboard widget lives in the context whose data it shows (`features/forms/widgets/FormsTodoWidget.tsx`), along with its helpers. `features/dashboard/` only lays widgets out. If a file doesn't fit the table, put it in the context that owns its data, and add it here.

### A context's shape

Each context has only the folders it needs:

| Path          | What goes there                                                    |
| ------------- | ------------------------------------------------------------------ |
| `index.ts`    | Public API: enums, types, Zod contracts, pure logic, and hooks     |
| `server.ts`   | Public API: services, for other contexts' server code              |
| `ui.ts`       | Public API: React components and widgets                           |
| `schema.ts`   | Its tables and the enums they use                                  |
| `config.ts`   | Its config keys                                                    |
| `api/`        | Its Hono sub-apps                                                  |
| `services/`   | Database access and business logic                                 |
| `components/` | React components                                                   |
| `widgets/`    | Dashboard widgets                                                  |
| `lib/`        | Pure logic and Zod contracts, shared by its server and client code |
| `hooks/`      | Client-side hooks                                                  |

### Schema

Each context owns its tables in its `schema.ts`. `core/db/schema.ts` re-exports every context's tables and defines the relations between them; Drizzle (`drizzle.config.ts` and the client in `core/db/index.ts`) reads that barrel. Services import tables from `@/core/db/schema`. Everything else imports enums and types from the context that owns them, through its `index.ts`. Add a table to `tests/unit/setup.ts`'s cleanup list too.

### Routes

`features/app.ts` is the only Hono root. `app/api/[[...route]]/route.ts` serves it, and the typed RPC client and the tests call it. Add a sub-app to its `.route()` chain, which is what types the RPC client.

### The boundary rule

`eslint.config.mjs` enforces these with `no-restricted-imports`:

- A context imports another only through its public API, `@/features/<context>`, `@/features/<context>/server`, or `@/features/<context>/ui`, never through any other file inside it.
- `core/` never imports `features/`. The exceptions are by design: `core/db/schema.ts` collects every context's tables, `core/config/registry.ts` collects every context's config keys, and the RPC client imports `type { AppType }` from `features/app.ts`.
- `@/core/db` and `drizzle-orm` are only for a context's `services/`, `core/`, `scripts/`, and `tests/`. A context's `schema.ts` may define tables, and type-only Drizzle imports are allowed anywhere.
- `app/`, `scripts/`, `tests/`, and `features/app.ts` are composition code and may import any context's internals.

Files that broke the rule before it existed are listed, with the reason, in `BOUNDARY_BASELINE` in `eslint.config.mjs`. #337 empties that list. Don't add to it; fix the import instead.

### A context's public API: `index.ts`, `server.ts`, and `ui.ts`

The public API is three files, because each kind of code has to load in different places:

- **`index.ts`**: enums, types, Zod contracts, pure logic, and hooks. Anything may import it, including client components, other contexts' `lib/` and `schema.ts`, seed scripts, and Playwright tests. It never reaches a service, so pure code that imports a context can't pull in the database or form an import cycle through `OrganizationConfigService`.
- **`server.ts`**: services, for other contexts' services, routes, and server components.
- **`ui.ts`**: components and widgets. Seed scripts (`tsx`) and Playwright load code outside the bundler, where CSS module imports fail, so only components and pages import `ui.ts`.

Some widgets in a `ui.ts` are server components that call services, next to client components. `package.json` declares the app's modules free of side effects (`"sideEffects": ["*.css"]`), so when a client component imports one client component from a `ui.ts`, Next drops the other re-exports instead of bundling those widgets' services, and `pg` with them, for the browser. Without it, that import fails `next build` with "Module not found: Can't resolve 'fs'". Because of this, a module must not do work at import time that other code depends on: export a function and call it instead.

Export only what another context uses today, and add to these files as that changes. Within a context, import files directly (`@/features/forms/lib/schema`), not through its own public API, which avoids import cycles.

## Future Work

There's still lots to be done on core ServiceStart (as opposed to individual deployments). Currently, the color is only customizable on the login/signup pages and file storage still needs the finishing touches put on. See the GitHub Issues for more.

When building individual projects with ServiceStart, focus on "how can we extend ServiceStart to handle our project out-of-the-box?" rather than "how can we build our project starting with ServiceStart." Basically, we want a robust and expansive ServiceStart, not a bunch of siloed projects all originating from the same codebase.
