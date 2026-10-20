# Fall 2026 sprint demo (Sprints 1–3)

Scope: fall tickets labelled **Sprint 1** (merged September 14), **Sprint 2**
(merged September 28–30), and **Sprint 3** (merged October 19–20). Sprints 1 and 2
were checked against `main` at `b3b0b02`; Sprint 3 against the Sprint 4 pre-sprint
branch (#315). Spring tickets reuse these labels and are excluded.

## Prepare the local website

Follow the README for dependencies, PostgreSQL, `.env`, and local Juno simulation.
Then, from the checkout root:

```bash
pnpm run db:migrate
pnpm exec tsx scripts/seedDemo.ts
pnpm dev
```

The demo seed refuses remote databases. It retains account passwords and IDs,
request history, registrations, and ordinary events. It refreshes two dedicated
demo events: a published cleanup in two weeks and an editable draft in three weeks.
Rerunning resets edits/publication of those two demo events and refreshes the
`horizontal-center` tenant's demo branding. It does not reset notification read
state or reverse join-request decisions. Create a new event or applicant for each
rehearsal rather than approving the same applicant repeatedly.

The demo seed runs the regular seed first, so it also sets up the Sprint 3
tenant, Visionaries to the Throne, at `visionariestothethrone.lvh.me:3000`.
Rerunning it resets that tenant's demo state (see
[the Visionaries guide](VISIONARIES_DEVELOPMENT.md#urls-and-accounts)): its
student accounts' responses and member types, its demo forms, and its invitation
links. Add `visionariestothethrone.lvh.me` to `ALLOWED_DEV_ORIGINS` in `.env`
first, as that guide describes.

The cloud environment uses the repository's email stub instead of the full Juno
containers. With `JUNO_API_KEY=local-stub-key` in the ignored local `.env`, use
these commands in separate terminals instead of `pnpm dev`:

```bash
mkdir -p /tmp/servicestart
node .claude/skills/run-servicestart/juno-stub.mjs
```

```bash
pnpm run db:start
pnpm exec next dev --webpack -p 3000
```

The stub records sends in `/tmp/servicestart/juno-requests.log` and accepts them
without delivering mail. Never present stub success as inbox delivery. For a
Docker Desktop demo, the README's default Juno mode also simulates delivery;
real mail needs the team-assisted setup described there.

All seeded accounts use `password123`. On `localhost:3000`, use:

| Account                            | Purpose                                            |
| ---------------------------------- | -------------------------------------------------- |
| `admin@example.com`                | Events, member directory, email, request decisions |
| `member1@example.com`              | Event registration and notifications               |
| `member2@example.com`              | A second volunteer                                 |
| `joinrequest-pending@example.com`  | Pending-access screen                              |
| `joinrequest-approved@example.com` | Approved member access                             |
| `joinrequest-denied@example.com`   | Denied-access screen                               |

The Sprint 3 walkthrough uses the Visionaries accounts in
[the Visionaries guide](VISIONARIES_DEVELOPMENT.md#urls-and-accounts), on the
Visionaries host: mainly `admin@example.com`, `applicant@example.com` (hasn't
applied yet), and `member1@example.com`.

Use separate browser profiles for admin and member so switching is quick. Visit
each demo page before presenting to finish the dev server's first compilation.
Do not run `next build` while rehearsing on the same checkout's dev server.

## Sprints 1 and 2 walkthrough (about 12 minutes)

| Feature                           | Tickets            | What to show                                                                                                                                                                                                                                                                                                                            |
| --------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signed-out organization branding  | #253, #254, #262   | Compare the orange ServiceStart login with `horizontal-center.lvh.me:3000/login`: purple colors, the local BoG logo, and “Together we serve our community.” Show signup, forgot password, and reset password with the same branding. ServiceStart retains the fallback logo.                                                            |
| Unknown organization handling     | #252, #268         | Visit `missing-auth-a.lvh.me:3000/login`. Show the useful error, recovery link, and absence of a login form. Repeat on signup if useful.                                                                                                                                                                                                |
| Full event lifecycle              | #277, PR #284      | Admin creates a **new** event, saves a draft, edits it, and publishes it. Member discovers it, registers, and unregisters. Admin edits the title, unpublishes, and deletes with confirmation. The preseeded cleanup makes the dashboard nonempty before you create anything.                                                            |
| Admin email                       | #255, #99, PR #285 | Select a member in the directory and click **Email selected**. Enter headline, subtitle, text, and footer. Send and show success. Repeat via **Inbox → New +**, selecting a recipient there. In this environment, show the recorded payload rather than an external inbox. A member has no **New +** action.                            |
| Notification bell and read status | #191, PR #287      | As a member, open the bell/sidebar, open the full inbox, and open an unread notification. Its detail view marks it read and reduces the unread count. Also show the dashboard's unread indicators.                                                                                                                                      |
| Requests on mobile                | #159, #297         | As admin, open **Members → Requests** at a 390px-wide viewport. Show loaded pending/approved/denied sections, search, and scrolling. For an interactive decision, sign up a fresh test applicant, approve the request, and sign in as that applicant to show access. Removing access and denying with a reason are optional follow-ups. |

For a new event, choose a date next month, start/end times, a description, a full
address, and a positive capacity. Leaving required publication fields empty should
show validation; a minimal title-only draft is allowed. Use a new test applicant
email for each rehearsal; signup creates a pending request automatically.

## Sprint 3 walkthrough (about 12 minutes)

Sprint 3 is turned on and styled per organization. Visionaries is an ordinary
tenant with config rows (`scripts/visionariesSeed.ts`), not special-cased code,
and ServiceStart at `localhost:3000` shows that an org without them is
unchanged. Unless a row says otherwise, use
`http://visionariestothethrone.lvh.me:3000`.

| Feature                | Tickets       | What to show                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-organization theme | #300, PR #311 | Put `localhost:3000/login` beside the Visionaries login. Visionaries has its purple, cream background, Fredoka and Lexend fonts, pill-shaped buttons and inputs, and logo. ServiceStart keeps its orange default. Sign in as admin on both to show the navbar, buttons, and settings pages following each theme.                                                                                                                                                                          |
| Auth pages             | #301, PR #310 | Signed out: log in with a wrong password for the inline error, and use the show/hide toggle. On signup, try `member1@example.com` for “Uh-oh, account already exists” with its login link. Show forgot password.                                                                                                                                                                                                                                                                          |
| Auto-approved signups  | #302, PR #314 | Sign up with a new address. You land on the dashboard as an applicant straight away, with no join request to approve. Open `/members` as that user: applicants are sent home, since the directory would show them other students' details.                                                                                                                                                                                                                                                |
| Member types           | #302, PR #314 | As admin, open **Members**. Show the Type column and the **All types** filter. Change Marcus Hill from Applicant to Current Attendee in his row, then select the other applicants and use **Mark as current attendee**. The seed puts them back.                                                                                                                                                                                                                                          |
| Admin invitations      | #301, #302    | As admin, click the add-member icon under the search box, choose **Admin**, and send. The email isn't delivered locally, so open the seeded links instead (in [the Visionaries guide](VISIONARIES_DEVELOPMENT.md#urls-and-accounts)). Signed out, the counselor link asks for a new account and joins as an admin (**Settings** appears). The nonmember link asks you to log in, then **Accept invitation**. Also show the expired link, and the counselor link while signed in as admin. |
| Form management        | #303, PR #313 | As admin, open **Settings → Forms**: published, draft, and closed forms with question and response counts. Open `/forms/family-showcase-rsvp?preview=1` for the draft's preview, then **Publish** it and **Copy link**. **Reopen** and **Close** the Open House RSVP. **Export CSV** for the camp application (five responses, with headshot links). Open **Settings** on a form for its options. **Create Form** and **Delete** a throwaway draft.                                       |
| Filling out a form     | #299, PR #309 | As `applicant@example.com`, open `/forms/camp-application-2027`. Submit it empty for the inline errors, then fill it in (sample essay below) and upload any JPEG, PNG, or WebP headshot under 5 MB. Submit, then reopen the link: “You've already responded” links to the read-only response. As `member1@example.com`, answer the Family Showcase RSVP you published; the admin's forms list shows its response. `/forms/open-house-rsvp-2026` shows the closed state.                   |

The application's essay question needs 100–150 words. You can paste this:

<details>
<summary>Sample answer (123 words)</summary>

I want to be a part of this camp because I want to grow as a leader in my
school and my community. Last year I started a reading club for younger
students, and I learned how much I enjoy helping other people find their
confidence. At camp I hope to practice public speaking, learn how to plan
projects that make a real difference, and meet other students who care about
the same things I do. I also want to get better at working on a team,
listening to different ideas, and following through when things get hard. I
know this camp will challenge me, and I am ready to give my best effort every
day and bring what I learn back home.

</details>

## Leave out of the website demo

- Shift isolation/capacity/authorization (#278): verified backend behavior, with no
  shift-management UI to present yet.
- Join-request unit coverage (#188): mention as reliability work, not a screen.
- Staging inbox delivery (#256): still open and not verified here.
- Email builder/template selection (#258, #98, #100): not delivered by these sprints.
- **Edit questions** in the forms list: it opens a 404. The question builder
  (#298) didn't land in Sprint 3 and is Sprint 4's #321.
- The Visionaries applicant and attendee dashboards: the pre-sprint gave them
  Sprint 4's layouts, so most of their cards say “Coming soon”. Present them as
  where Sprint 4 starts, or skip them.
- The dashboard's **Events** card: it's a placeholder that always says “No
  upcoming events”. Show the **Events** page instead.
- Links in invitation emails: they point at `localhost:3000`, so an invitation
  from another org opens a 404 there. Use the seeded invitation links.

## Rehearsal evidence and fixes

Checked in Chromium on October 5, 2026 against local PostgreSQL and the email stub:
draft creation/publication, member registration/withdrawal, event edits/unpublication,
both email entry points, preservation of all four message fields, notification
detail/read count, real configured branding on all four auth pages, tenant login,
a populated mobile requests panel, and signup → pending request → admin approval
→ applicant dashboard access.

The review change fixes duplicate/contradictory seed requests and dangling seed
notifications, gives the approved fixture actual membership, supplies future demo
events and branding, fixes inbox hydration with cached auth data, and renders unknown
tenant errors on the server. It also runs the server-side media test in Node so its
multipart data uses compatible globals.

The inbox Chromium suite covers permissions, tenant-scoped recipients, successful
sends, retained drafts/retry on failed sends, and recipient-load retry. Missing-tenant
tests cover all four auth pages on two hosts with JavaScript assets blocked. Email
transport failures in that suite are deliberately intercepted; live delivery and
the full Juno container stack remain outside this cloud rehearsal.
