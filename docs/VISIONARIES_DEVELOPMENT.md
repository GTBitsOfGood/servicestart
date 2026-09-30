# Visionaries to the Throne development

This development tenant is the organization Sprint 3 builds against: forms
(#298, #299, #303), theming (#300), the auth pages (#301), and member types
(#302). It does not provision a production deployment.

## First-time setup

Complete the [README local setup](../README.md#getting-started), including Docker,
Juno, your local `.env`, and database migrations. Keep the template's simulated
email configuration for ordinary development.

Add `visionariestothethrone.lvh.me` to the comma-separated `ALLOWED_DEV_ORIGINS`
value in your local `.env` (preserve any existing entries). Restart Next.js after
changing it. For this tenant's auth work, set:

```dotenv
BETTER_AUTH_URL=http://visionariestothethrone.lvh.me:3000
```

With your **local development database** configured, run:

```bash
pnpm run db:migrate
pnpm run db:seed
pnpm dev
```

Do not run the development seed against production: it creates accounts with
known test passwords. Existing contributors can pull this change and rerun
`pnpm run db:migrate` and `pnpm run db:seed`.

## URLs and accounts

- Signup: <http://visionariestothethrone.lvh.me:3000/signup>
- Login: <http://visionariestothethrone.lvh.me:3000/login>
- Existing application home: <http://visionariestothethrone.lvh.me:3000/>

`lvh.me` resolves to loopback; no hosts-file entry is normally needed. Use the
tenant hostname, not `localhost`, which selects the default ServiceStart tenant.

All these development accounts use `password123`:

| Email                   | Existing ServiceStart role | Use                                   |
| ----------------------- | -------------------------- | ------------------------------------- |
| `owner@example.com`     | owner                      | Organization owner controls           |
| `admin@example.com`     | admin                      | Staff access; created the application |
| `member1@example.com`   | member                     | Student/member access                 |
| `member2@example.com`   | member                     | Second student/member                 |
| `applicant@example.com` | member (`applicant` type)  | Student applying to camp              |
| `nonmember@example.com` | none                       | Signed-in user without membership     |

Except for `applicant@example.com`, which only Visionaries has, the same email
addresses exist in other seeded organizations, with distinct user IDs and
memberships. Accounts are selected by the tenant hostname. Public signup
continues to use existing ServiceStart behavior; a member fixture does not imply
camp acceptance or automatic membership for new signups.

## Configuration and scope

- Organization ID: `org_visionariestothethrone`
- Slug: `visionariestothethrone`
- Primary color: `#5C218C`; secondary color: `#C29BDC` (Figma palette).
- Development tagline: `Visionaries to the Throne`.
- Initial navbar: horizontal-center, white.
- Forms: `FormsEnabled` is on, with a published copy of the camp application
  (form ID `camp-application-2027`; its questions are in
  `tests/unit/fixtures/forms.ts`). #299 builds its page,
  `/forms/camp-application-2027`.

These are organization configuration rows, not organization-name checks in app
code. They live in the "Visionaries setup" section of `scripts/seed.ts`; add
new Visionaries config rows there. Rerunning the seed reapplies these
configuration defaults while retaining existing account IDs and credentials.
The seed does not set `LogoUrl`: until an approved logo is configured, the
existing ServiceStart/Sunset fallback appears. Configure the approved asset
through the existing `LogoUrl` setting when available.

The current shared login/signup UI is intentional. The final layout, logo, copy,
student/admin landing destinations, and account-versus-membership approval flow
are covered by #301 and #302. Use the existing home page to exercise
development accounts until those destinations are built. The applicant's
member type takes effect once #302 turns on `MemberTypesEnabled`.

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
