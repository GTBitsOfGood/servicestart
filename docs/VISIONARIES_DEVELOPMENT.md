# Visionaries to the Throne development

This development tenant is the organization Sprints 3 and 4 build against.
Sprint 3 built forms (#299, #303), theming (#300), the auth pages (#301), and
member types (#302). Sprint 4 builds application review (#316, #317), the
applicant and attendee portals (#318, #319), the configurable dashboard (#320),
and the question builder (#321) on the pre-sprint setup (#315). It does not
provision a production deployment.

## First-time setup

Complete the [README local setup](../README.md#getting-started), including Docker,
Juno, your local `.env`, and database migrations. Keep the template's simulated
email configuration for ordinary development.

Add `visionariestothethrone.lvh.me` to the comma-separated `ALLOWED_DEV_ORIGINS`
value in your local `.env` (preserve any existing entries). Restart Next.js after
changing it.

Leave `BETTER_AUTH_URL` at the template's `http://localhost:3000`. Visionaries,
ServiceStart at `localhost:3000`, and the other seeded tenants all work with it
at the same time. Change it only when you need links that Better Auth builds,
such as the password reset link, to open on the Visionaries host:

```dotenv
BETTER_AUTH_URL=http://visionariestothethrone.lvh.me:3000
```

`localhost:3000` keeps working with either value. Restart Next.js after changing
it.

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

All these development accounts use `password123`. Each student account is at
a different stage of the camp process:

| Email                           | Role and type     | State                                         |
| ------------------------------- | ----------------- | --------------------------------------------- |
| `owner@example.com`             | owner             | Organization owner controls                   |
| `admin@example.com`             | admin             | Staff access; created the forms               |
| `applicant@example.com`         | member, applicant | Hasn't started the camp application           |
| `applicant-pending@example.com` | member, applicant | Application submitted, Pending                |
| `applicant-review@example.com`  | member, applicant | Application Under Review                      |
| `member2@example.com`           | member, attendee  | Accepted; 0 of 4 camp forms done              |
| `member1@example.com`           | member, attendee  | Accepted; 2 of 4 (Emergency Contact, Consent) |
| `attendee-complete@example.com` | member, attendee  | Accepted; all 4 camp forms done               |
| `nonmember@example.com`         | none              | Not a member; has a pending invitation        |

The owner, admin, member, and nonmember addresses also exist in the other
seeded organizations, with distinct user IDs and memberships; the rest are
Visionaries only. Accounts are selected by the tenant hostname. Signing up on
the Visionaries host makes you an applicant right away (`AutoApproveSignups`).

Each of these invitation links shows a different state of the
accept-invitation page. Open them signed out:

| Link                                                                                       | Shows                                             |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| <http://visionariestothethrone.lvh.me:3000/accept-invitation/visionaries-invite-counselor> | No account yet: create one, then join as an admin |
| <http://visionariestothethrone.lvh.me:3000/accept-invitation/visionaries-invite-nonmember> | `nonmember@example.com`'s invite: log in, accept  |
| <http://visionariestothethrone.lvh.me:3000/accept-invitation/visionaries-invite-expired>   | An expired invitation                             |

Opening the first link while signed in as someone else shows the
wrong-account state.

**Rerunning the seed resets these student accounts**: their member types, their
responses to the seeded forms (responses added while testing are deleted), the
responses' review statuses, admins' requests to complete the seeded forms,
and the attendees' alert, which is unread again.
It also resets the demo forms below (their status, details, and all their
responses) and the invitations: each is pending again, the account created
from the counselor invitation (`counselor@example.com`) is deleted, and
`nonmember@example.com` loses the membership it accepted.
Use a fresh signup when you want data the seed leaves alone. Seeded forms and
responses have fixed IDs (`visionariesId` in `tests/unit/fixtures/forms.ts`).

## Configuration and scope

- Organization ID: `org_visionariestothethrone`
- Slug: `visionariestothethrone`
- Primary color: `#5C218C`; secondary color: `#C29BDC` (Figma palette).
- Development tagline: `Visionaries to the Throne`.
- Initial navbar: horizontal-center, white.
- Forms: `FormsEnabled` is on, with a published copy of the camp application
  at `/forms/camp-application-2027` (its questions are in
  `tests/unit/fixtures/forms.ts`).
- Member types: `MemberTypesEnabled` and `AutoApproveSignups` are on.
- Logo: `public/organizations/visionaries-logo.png` (`LogoUrl`), from the Figma.
- Required forms: four published forms assigned to current attendees, with due
  dates: Emergency Contact Information, Consent Form, Medical History, and
  Liability Release Form. The camp application is assigned to applicants, and
  accepting a response makes the student a current attendee
  (`acceptedMemberType`, #316). The forms use only Sprint 3 question types.
- Demo forms for form management, assigned to no member type: a draft
  Family Showcase RSVP (`family-showcase-rsvp`) to preview and publish, and a
  closed Fall 2026 Open House RSVP (`open-house-rsvp-2026`) to reopen.
- Dashboards: an applicant layout (application status and notifications) and
  an attendee layout (to-do list, weekly calendar, completed forms, and
  progress). Until their tickets land, those widgets show "Coming soon".
- Dashboard header, navbar, and footer config rows (#318, #320), with
  development copy from the Figma.
- Camp events this week and next, dated from when the seed runs, and an alert
  for accepted campers.

These are organization configuration rows and seed data, not organization-name
checks in app code. They live in `scripts/visionariesSeed.ts`; add new
Visionaries config rows and demo data there. Rerunning the seed reapplies these
configuration defaults while retaining existing account IDs and credentials.
Headshots for the seeded applications are stored through the configured
`FileService`; without file storage (for example in CI) they're skipped and
the images don't load.

## Verify your setup

1. Open signup while signed out; verify the Visionaries name, logo, and purple background.
2. Sign in as `applicant-pending@example.com`; the dashboard has the applicant
   layout. Open `/forms/camp-application-2027/response` to see the response.
3. Sign in as `member1@example.com`; the dashboard has the attendee layout.
4. Sign in as `admin@example.com` and open **Settings → Forms**.
5. Rerun the seed and confirm the same accounts still work.

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
