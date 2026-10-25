# Development tenants

These two ordinary organizations are compact sandboxes for sprint reviews and feature development. They run on the same app/database as ServiceStart, with isolated accounts and records and different organization config rows. Existing ServiceStart and Visionaries tenants remain available.

| Tenant           | Local URL                           | Configuration                                                                                                                                                             |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VolunteerStart   | http://volunteerstart.lvh.me:3000   | Teal/amber, mint background, Visby headings, Open Sans body, square controls, horizontal-left navigation; manual membership approval, member types off                    |
| ApplicationStart | http://applicationstart.lvh.me:3000 | Purple/lavender, cream background, Fredoka display, Lexend headings/body, pill controls, horizontal-center navigation; auto-approved signup as applicant, member types on |

## Setup

With your local database migrated, run `pnpm run db:seed`. No additional server or deployment is required. `scripts/seedDemo.ts` also includes these tenants because it calls the regular seed.

Both tenant hosts are included in `next.config.js` development origins, alongside any `ALLOWED_DEV_ORIGINS` entries from `.env`. Keep `BETTER_AUTH_URL=http://localhost:3000` for ordinary development. Use the tenant hostname to select the organization.

Seeds contain known development passwords; use a local or disposable preview database, never a production database.

## Accounts

All accounts use `password123`. The same email on different tenants represents separate users. Use separate browser profiles for admin and participant views.

Both tenants have `owner@example.com`, `admin@example.com`, `member1@example.com`, `member2@example.com`, `nonmember@example.com`, and `joinrequest-pending@example.com`, `joinrequest-approved@example.com`, `joinrequest-denied@example.com`.

### VolunteerStart

- Owner/admin: event editing, membership decisions, member directory, email, and form management.
- Member 1: registered for Community Park Cleanup and its full one-person Setup crew shift; has answered Volunteer Interest.
- Member 2: unregistered; can register for the event and the open Cleanup crew shift. Shift management is currently available through the API, with fixed IDs `event_volunteerstart_1`, `shift_volunteerstart_1`, and `shift_volunteerstart_2`.
- Three request accounts: pending, approved with membership, and denied with a reason. New signup requires approval.
- Five events: upcoming cleanup, meal packing, and members-only orientation; a past garden day; and a future draft supply drive. Event dates refresh relative to seeding.
- Three forms: published `/forms/volunteer-interest` with one response; draft `/forms/volunteer-feedback`; closed `/forms/orientation-rsvp`. Use **Settings → Forms** for preview, publication, close/reopen, CSV export, and a throwaway form for the Sprint 4 builder.
- A few read/unread notifications and pending/expired invitations. Signed out, visit `/accept-invitation/volunteerstart-invite-nonmember` or `/accept-invitation/volunteerstart-invite-expired`.

### ApplicationStart

| Account                          | Application state          | Required attendee forms completed |
| -------------------------------- | -------------------------- | --------------------------------- |
| `applicant@example.com`          | Not started                | —                                 |
| `applicant-pending@example.com`  | Pending                    | —                                 |
| `applicant-review@example.com`   | Under review               | —                                 |
| `applicant-rejected@example.com` | Rejected                   | —                                 |
| `member2@example.com`            | Accepted; current attendee | 0 of 4                            |
| `member1@example.com`            | Accepted; current attendee | 2 of 4                            |
| `attendee-complete@example.com`  | Accepted; current attendee | 4 of 4                            |

- Published application: `/forms/camp-application-2027`, including a headshot upload and seeded responses in all four review states. The URL keys intentionally match Visionaries while the database IDs are independent, making tenant isolation easy to test.
- Four assigned attendee forms: Emergency Contact, Consent, Medical History, and Liability Release. Their deadlines and close dates roll forward from seeding so developers can keep submitting them.
- Draft Family Showcase RSVP and closed Open House RSVP for form management.
- Five published camp events in this week and next, and an unread alert for accepted attendees.
- Pending new-account/admin invitation: `/accept-invitation/applicationstart-invite-counselor`; existing-account invitation: `/accept-invitation/applicationstart-invite-nonmember`; expired: `/accept-invitation/applicationstart-invite-expired`.
- Applicant status widget config points at the application; attendee layout includes forms to do, completed forms, progress, and a weekly calendar. Audience-specific headings/nav labels and footer configuration are populated.

Sprint 4 review screens, applicant/attendee widgets, and the question builder remain dependent on their implementation tickets. Seeded statuses and layout configuration make those features testable as they land; a placeholder card does not indicate working review UI. File uploads use the configured `FileService`; missing storage produces a seed warning and unavailable headshots.

## Reseeding and extending

Rerunning `pnpm run db:seed` retains account IDs/passwords and developer-created forms/events. It reapplies tenant configuration and resets the documented fixtures:

- VolunteerStart: its three forms and responses, event details, cleanup registrations and shift RSVPs, three request personas/history, notifications, and invitations.
- ApplicationStart: seeded account member types, their responses to the required forms and review statuses, draft/closed demo form responses, event details, attendee alerts, and invitations. Required questions remain locked after publication, matching the existing Visionaries seed behavior.

Use a fresh account and a new form/event when you want experiments to survive reseeding. A developer-created form using a reserved seed URL key causes a clear conflict rather than being overwritten.

`developmentSeed.ts` defines the two tenants and VolunteerStart fixtures. ApplicationStart reuses the application workflow factory in `visionariesSeed.ts`, with independent form/component/submission/upload IDs. Add future Sprint 4 fixtures there through ordinary schema/config values; do not special-case these slugs in product code.

Verify seed behavior with `pnpm exec vitest run tests/unit/scripts/seed.test.ts` against the configured test Postgres. It covers tenant login, workflow states, isolation, and repeatable resets alongside the existing tenants.
