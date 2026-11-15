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

| Folder                     | What's in it                                                                                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/db/`                 | The Drizzle client (`index.ts`), the schema barrel (`schema.ts`), and shared column types (`columns.ts`)                                                                                                                                     |
| `core/auth/`               | BetterAuth (`auth.ts`, `authClient.ts`), the route and page guards (`authUtils.ts`, `featureGuards.ts`), the guards' membership lookup (`membership.ts`), `UserService`, the auth hook registry (`authHooks.ts`), the auth pages' components |
| `core/tenant/`             | Organizations and finding the one a request is for (host parsing, `OrganizationService`, `useActiveOrganization`)                                                                                                                            |
| `core/config/`             | `organization_config`, `defineConfig` and the key registry, the store, `OrganizationConfigService`, its hook, branding and theme. Its route is in `features/settings/`                                                                       |
| `core/features/`           | `defineFeature`, the type of a feature manifest                                                                                                                                                                                              |
| `core/api/`                | The typed RPC client (`client.ts`), typed errors, `ping`                                                                                                                                                                                     |
| `core/files/`              | `FileService` and its local and Juno implementations                                                                                                                                                                                         |
| `core/email/`              | `EmailService`, the email transport (invitations, password resets, sender addresses), and email setup                                                                                                                                        |
| `core/utils/`              | Generic helpers by purpose (`dates.ts`, `strings.ts`, `urls.ts`), `cn` (`utils.ts`), hooks, and `env.ts`                                                                                                                                     |
| `features/registry.ts`     | Every feature's manifest; the navbar and the widget picker read it                                                                                                                                                                           |
| `features/membership/`     | Members, roles, member types, invitations, join requests, profiles, audiences, and the signup and member-removal auth hooks                                                                                                                  |
| `features/events/`         | Events, shifts, RSVPs, tags, and the events and weekly calendar widgets                                                                                                                                                                      |
| `features/forms/`          | Forms, questions, responses, review, information requests, and the forms and application status widgets                                                                                                                                      |
| `features/communications/` | Notifications, alerts, announcements, messages, email to members (`MemberEmailService`), and the notifications and newsletter widgets                                                                                                        |
| `features/media/`          | The media library and serving images (`api/serveImage.ts`)                                                                                                                                                                                   |
| `features/dashboard/`      | The dashboard grid, header, layout schema and builder, the widget options (`widgets.ts`), the dashboard config keys (`config.ts`), and member types' layouts (`DashboardLayoutService`)                                                      |
| `features/navigation/`     | The navbar (`navItems.ts`, `navbarConfig.ts`, `getNavbarItems.ts`), the footer, and the organization logo                                                                                                                                    |
| `features/settings/`       | The Settings nav item and the organization config route (`api/organizationConfig.ts`). A leaf: nothing imports it, so it may use membership and dashboard                                                                                    |

A dashboard widget lives in the context whose data it shows (`features/forms/widgets/FormsTodoWidget.tsx`), along with its helpers. `features/dashboard/` only lays widgets out. If a file doesn't fit the table, put it in the context that owns its data, and add it here.

### A context's shape

Each context has only the folders it needs:

| Path          | What goes there                                                    |
| ------------- | ------------------------------------------------------------------ |
| `feature.ts`  | Its manifest: toggle, navbar items, and widgets (metadata only)    |
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

### Finding the request's organization

`core/tenant/host.ts` is the only host parser, shared by the browser, server,
and edge proxy. `NEXT_PUBLIC_TENANT_ROOT_DOMAIN` (or the existing
`E2E_TENANT_DOMAIN` at build time) selects the root; `lvh.me` also works locally.
Only a single tenant label is accepted. Root hosts, `www`, loopback hosts,
unrelated domains, and Netlify preview names do not name an organization.
Unlike the old permissive parser, an arbitrary three-label domain is never a
tenant, and default hosts no longer implicitly select `servicestart`.

`resolveOrganization(headersOrContext, session)` in `core/tenant/resolveOrganization.ts`
returns the host's organization, or the active session organization on a default
host. An unknown tenant returns null, even when the session has an active org.
Callers load the session and pass it in, so BetterAuth hooks cannot recurse into
session loading. Identity endpoints may use an explicit organization hint only
on a default host; anonymous default-host pages use platform branding defaults.

API guards authorize the active session org and reject a conflicting tenant
host with 403 before data access. A session without an active org is handled by
the route's existing membership/login rules. Private form images keep their
concealed 404 response. A user may read their own assigned profile photo across
organizations while retaining membership in both the current and storage
organizations; other media stays scoped to the request organization. Server pages resolve the host first and authorize
membership in that organization. The browser synchronizes only tenant hosts;
on default hosts it leaves the active organization alone.

HTTP exceptions use the root API's JSON `{ error: message }` renderer. Unexpected
errors are logged and return a generic 500. Feature-specific adapters retain
structured validation and business-error details. The separate image-serving
entrypoint installs the same shared renderer.

### Routes

`features/app.ts` is the only Hono root. `app/api/[[...route]]/route.ts` serves it, and the typed RPC client and the tests call it. Add a sub-app to its `.route()` chain, which is what types the RPC client. Feature manifests never register routes. The one other Hono app is media's image route (`features/media/api/serveImage.ts`), which `app/images/[id]/route.ts` serves.

### The boundary rule

`eslint.config.mjs` enforces these with `no-restricted-imports`:

- A context imports another only through its public API, `@/features/<context>`, `@/features/<context>/server`, or `@/features/<context>/ui`, never through any other file inside it.
- `core/` never imports `features/`. The exceptions are by design: `core/db/schema.ts` collects every context's tables, `core/config/registry.ts` collects every context's config keys, and the RPC client imports `type { AppType }` from `features/app.ts`.
- `@/core/db` and `drizzle-orm` are only for a context's `services/`, `core/`, `scripts/`, and `tests/`. A context's `schema.ts` may define tables, and type-only Drizzle imports are allowed anywhere.
- `app/`, `scripts/`, `tests/`, `features/app.ts`, and `features/registry.ts` are composition code and may import any context's internals.

The rule has no exceptions list. Sprint 5 started with a `BOUNDARY_BASELINE` of files that broke it; #337 fixed each one and removed the list. When an import breaks the rule, move the code to the context that owns it, go through the context's public API, or move shared code into `core/`. Don't add a file-level override.

### A context's public API: `index.ts`, `server.ts`, and `ui.ts`

The public API is three files, because each kind of code has to load in different places:

- **`index.ts`**: enums, types, Zod contracts, pure logic, and hooks. Anything may import it, including client components, other contexts' `lib/` and `schema.ts`, seed scripts, and Playwright tests. It never reaches a service, so pure code that imports a context can't pull in the database or form an import cycle through `OrganizationConfigService`.
- **`server.ts`**: services, for other contexts' services, routes, and server components.
- **`ui.ts`**: components and widgets. Seed scripts (`tsx`) and Playwright load code outside the bundler, where CSS module imports fail, so only components and pages import `ui.ts`.

Some widgets in a `ui.ts` are server components that call services, next to client components. `package.json` declares the app's modules free of side effects (`"sideEffects": ["*.css"]`), so when a client component imports one client component from a `ui.ts`, Next drops the other re-exports instead of bundling those widgets' services, and `pg` with them, for the browser. Without it, that import fails `next build` with "Module not found: Can't resolve 'fs'". Because of this, a module must not do work at import time that other code depends on: export a function and call it instead.

Export only what another context uses today, and add to these files as that changes. Within a context, import files directly (`@/features/forms/lib/schema`), not through its own public API, which avoids import cycles.

### Feature manifests

_Added in #337._

Each context describes itself in `feature.ts` with `defineFeature` (`core/features/defineFeature.ts`):

- `id`: unique across features.
- `toggle`: a boolean config key (`ToggleableOrganizationFeature`). While it's off, the feature's navbar items and widgets are hidden.
- `navItems`: `{ label, href, icon?, order, parent?, requireAdmin? }`. Top-level items have an icon; a subpage names its top-level item's href as `parent` (settings pages use `parent: "/settings"`). Siblings sort by `order`, spaced by 10 so an item can go between two others.
- `widgets`: `{ id, label }`, the dashboard widgets the feature owns.

`features/registry.ts` lists every feature. `getNavbarItems` builds the navbar from it: it reads every toggle in one `getConfig` call, drops items whose toggle is off, admin-only items for non-admins, and items the audience's `NavbarConfig` hides, then applies the audience's labels. A hidden top-level item hides its subpages. `NAVBAR_HREFS` is every manifest href regardless of toggles, because stored `NavbarConfig` rows are keyed by href and validated against it. `getWidgetOptions` offers the manifests' widgets in `WIDGET_IDS` order, leaving out those whose feature is off.

One context can export more than one feature when parts of it have different toggles. Membership has three: `membership` (the join requests widget, always on), `members` (the Members page, `MembersPageEnabled`), and `memberTypes` (the Member types page, `MemberTypesEnabled`).

Manifests are metadata only: no React components, services, or `next/*` imports, and `IconName` is a type-only import. They reach the client bundle (`NavbarWrapper` imports `navItems.ts`, and the `NavbarConfig` schema checks hrefs against `NAVBAR_HREFS`). A manifest must not import `core/config/registry.ts` or `OrganizationConfigService`, which would make an import cycle through the config schemas.

Hiding is presentation only. Pages and routes keep their own guards: `notFoundIfFeatureDisabled` in pages and `assertFeatureEnabled` in routes (`core/auth/featureGuards.ts`), and `requireAdmin` and friends.

### Auth hooks

BetterAuth's hooks need membership code: signup files a join request or adds the member, and removing a member records it and cancels their upcoming RSVPs. `core/auth/auth.ts` can't import a feature, so it calls through a registry in `core/auth/authHooks.ts` (`afterSessionCreated`, `beforeRemoveMember`), and `registerMembershipAuthHooks()` in `features/membership/authHooks.ts` fills it. Imports go one way: membership imports core, and `auth.ts` never imports the registration.

- The registry lives on `globalThis`, because Next can load a module more than once (separate route bundles, HMR), and every copy must see the hooks.
- `auth.ts` throws if a hook runs before it's registered. Failing silently would drop new users' join requests and memberships.
- Registration is an explicit call in every entry point that can fire a hook, not a side effect hidden in a barrel: `app/api/auth/[...all]/route.ts` (signup and sign-in), `features/app.ts` (routes that remove members), `features/membership/server.ts`, `scripts/seed.ts`, `tests/unit/setup.ts`, `tests/e2e/testUtils.ts`, and `tests/e2e/acceptInvitation.spec.ts`. In the Next app the auth route and `features/app.ts` are the ones that count: with `"sideEffects"` set, Next may skip evaluating `server.ts` when it only re-exports what a caller uses. A new entry point that signs users up or removes members (a script, a server action calling `auth.api`) must call it too.
- The hook bodies (`features/membership/services/MembershipAuthHooks.ts`) load on first use, so registering is cheap and can't take part in an import cycle.

### Server-only code

Every service and every server-only `core/` module starts with `import "server-only";`, so a client component that imports one fails `next build` instead of shipping the database client to the browser. A unit test (`tests/unit/core/serverOnly.test.ts`) checks the services.

- **Mark:** `features/*/services/*.ts`, `core/db/index.ts`, `core/auth/{auth,authUtils,authHooks,featureGuards,membership,UserService}.ts`, `core/tenant/{OrganizationService,resolveOrganization}.ts`, `core/email/*Service.ts` and `emailSetup.ts`, `core/files/` except `junoFileUtils.ts`, `core/config/{OrganizationConfigService,store}.ts`, `features/navigation/getNavbarItems.ts`, and the two route files that moved out of `core/` in #337 (`features/media/api/serveImage.ts`, `features/settings/api/organizationConfig.ts`).
- **Never mark:** `core/utils/env.ts` (`drizzle.config.ts` loads it under plain Node), schema files and barrels, the config definitions (`registry.ts`, `config.ts`, `defineConfig.ts`, branding and theme), `core/api/client.ts`, `core/auth/{authClient,authValidation}.ts` and its components and hooks, `core/tenant/{host,organizationRoutes,urls,clientAuthUtils}.ts` (`proxy.ts` runs outside React Server Components), `core/utils/`, and `core/files/junoFileUtils.ts`. Before marking a module, move anything client code needs out of it (types and enums go in the context's `lib/`).
- Outside Next, `server-only` throws, so code that runs there gets the package's no-op (`server-only/empty.js`): Vitest aliases it in `vitest.config.ts` and `vitest.config.setup.ts`, and tsx scripts and Playwright run with `--tsconfig tsconfig.scripts.json`, which extends `tsconfig.json` and maps `server-only` to the stub. Never add that mapping to `tsconfig.json`: Next would read it and the check would quietly stop working. To run a script by hand, use `pnpm exec tsx --tsconfig tsconfig.scripts.json scripts/<name>.ts`.

To check the guard, import a service into a `"use client"` component and run `pnpm build`. It fails with `You're importing a module that depends on "server-only"` and an import trace through the client component. Revert the import afterwards.

### Adding a feature

A walkthrough, using a made-up volunteer hours feature. Real examples to copy: `features/forms/` for a toggle, a settings page, and widgets; `features/media/` for a small one.

1. **Create the folder**, `features/hours/`, with only the subfolders it needs (see "A context's shape"). Add `"hours"` to `CONTEXTS` in `eslint.config.mjs`, so the boundary rule covers it.
2. **Write `feature.ts`** and add it to `features/registry.ts`. Keep it metadata only, since it ends up in the client bundle:

   ```ts
   import { defineFeature } from "@/core/features/defineFeature";
   import { OrganizationConfigKey } from "@/core/config/schema";

   export const hours = defineFeature({
     id: "hours",
     toggle: OrganizationConfigKey.HoursEnabled,
     navItems: [
       {
         label: "Hours",
         href: "/settings/hours",
         order: 60,
         parent: "/settings",
         requireAdmin: true,
       },
     ],
     widgets: [{ id: "hours_summary", label: "Hours Summary" }],
   });
   ```

3. **Declare the toggle** in `config.ts` with `defineConfig`, the way `features/forms/config.ts` declares `FormsEnabled`: add `HoursEnabled` to `OrganizationConfigKey`, add it to `ToggleableOrganizationFeature`, and add the context's group to `core/config/registry.ts`. It defaults to `false`; turn it on for an org with a config row.
4. **Add the schema**: tables in `features/hours/schema.ts`, re-exported from `core/db/schema.ts`, then `pnpm run db:generate`. Add each table to `tests/unit/setup.ts`'s cleanup list.
5. **Add the routes**: a Hono sub-app in `features/hours/api/`, added to the `.route()` chain in `features/app.ts`.
6. **Add the guards**, since hiding the nav item isn't access control: `assertFeatureEnabled(organizationId, OrganizationConfigKey.HoursEnabled)` in each route, and `notFoundIfFeatureDisabled(...)` in each page (see `app/settings/forms/page.tsx`).
7. **Add widgets**: the manifest entry, the id in `WIDGET_IDS` (`features/dashboard/lib/schema.ts`), and the component in `WIDGET_COMPONENTS` (`DashboardGrid.tsx`). `WIDGET_IDS` stays a literal list rather than being built from the manifests, because the dashboard's layout schema would then import every feature; `tests/unit/features/registry.test.ts` checks the two agree, and `WIDGET_COMPONENTS` is typed to need every id.

Then add tests: a service and route test with the org A / org B case, and an e2e test for the user flow.

## Future Work

There's still lots to be done on core ServiceStart (as opposed to individual deployments). Currently, the color is only customizable on the login/signup pages and file storage still needs the finishing touches put on. See the GitHub Issues for more.

When building individual projects with ServiceStart, focus on "how can we extend ServiceStart to handle our project out-of-the-box?" rather than "how can we build our project starting with ServiceStart." Basically, we want a robust and expansive ServiceStart, not a bunch of siloed projects all originating from the same codebase.
