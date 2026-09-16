# Visionaries to the Throne development

This development tenant supports the signup (#274) and login (#275) work in the
shared ServiceStart codebase. It does not provision a production deployment or
implement the camper application workflow.

## First-time setup

Complete the [README local setup](../README.md#getting-started), including Docker,
Juno, your local `.env`, and database migrations. Keep the template's simulated
email configuration for ordinary development.

Add `visionariesforthethrone.lvh.me` to the comma-separated `ALLOWED_DEV_ORIGINS`
value in your local `.env` (preserve any existing entries). Restart Next.js after
changing it. For this tenant's auth work, set:

```dotenv
BETTER_AUTH_URL=http://visionariesforthethrone.lvh.me:3000
```

With your **local development database** configured, run:

```bash
pnpm run db:migrate
pnpm run db:seed
pnpm dev
```

Do not run the development seed against production: it creates accounts with
known test passwords. Existing contributors can pull this change and rerun
`pnpm run db:seed`; no new schema migration is required.

## URLs and accounts

- Signup: <http://visionariesforthethrone.lvh.me:3000/signup>
- Login: <http://visionariesforthethrone.lvh.me:3000/login>
- Existing application home: <http://visionariesforthethrone.lvh.me:3000/>

`lvh.me` resolves to loopback; no hosts-file entry is normally needed. Use the
tenant hostname, not `localhost`, which selects the default ServiceStart tenant.

All these development accounts use `password123`:

| Email                   | Existing ServiceStart role | Use                               |
| ----------------------- | -------------------------- | --------------------------------- |
| `owner@example.com`     | owner                      | Organization owner controls       |
| `admin@example.com`     | admin                      | Staff access                      |
| `member1@example.com`   | member                     | Student/member access             |
| `member2@example.com`   | member                     | Second student/member             |
| `nonmember@example.com` | none                       | Signed-in user without membership |

The same email addresses exist in other seeded organizations, with distinct user
IDs and memberships. Accounts are selected by the tenant hostname. Public signup
continues to use existing ServiceStart behavior; a member fixture does not imply
camp acceptance or automatic membership for new signups.

## Configuration and scope

- Organization ID: `org_visionariesforthethrone`
- Slug: `visionariesforthethrone`
- Primary color: `#5C218C`; secondary color: `#C29BDC` (Figma palette).
- Development tagline: `Visionaries to the Throne`.
- Initial navbar: horizontal-center, white.

These are organization configuration rows, not organization-name checks in app
code. Rerunning the seed reapplies these configuration defaults while retaining
existing account IDs and credentials. The seed does not set `LogoUrl`: until an
approved logo is configured, the existing ServiceStart/Sunset fallback appears.
Configure the approved asset through the existing `LogoUrl` setting when available.

The current shared login/signup UI is intentional. The final layout, logo, copy,
student/admin landing destinations, and account-versus-membership approval flow
remain part of product/design coordination for #274 and #275. Use the existing
home page to exercise development accounts until those destinations are built.
No user schema, camper schema, or new role is introduced here.

## Verify your setup

1. Open signup while signed out; verify the Visionaries name and purple background.
2. Sign in as `member1@example.com`, then sign out and sign in as `admin@example.com`.
3. Check the existing member and admin experiences using their respective accounts.
4. Rerun the seed and confirm the same accounts still work.

The seed integration suite checks repeatability, branding, roles, and login across
all seeded tenants. With the local test database running on port 5433:

```bash
pnpm exec vitest run tests/unit/scripts/seed.test.ts
```

New PR preview databases also run this seed through the existing workflow. An
existing preview database needs reseeding to receive the tenant. Preview hostname
and authentication-origin routing still need a valid tenant-aware URL; a normal
Netlify preview URL alone does not establish the Visionaries hostname. Local
development above is the supported starting point for these tickets.

`pnpm run setupOrg` sets up email and optional file storage; it does not create
the organization. Production organization provisioning, staff invitations, DNS,
and real email setup are separate maintainer tasks.

## Design reference

[Visionaries Figma section](https://www.figma.com/design/PtssEcXD74l902nKJ2uIAh/Service-Start-Fall-2026?node-id=20936-3387)
