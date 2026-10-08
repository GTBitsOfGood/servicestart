# Fall 2026 Sprint 1 and Sprint 2 demo

Scope: fall tickets labelled **Sprint 1** (merged September 14) and **Sprint 2**
(merged September 28–30), checked against `main` at `b3b0b02`. Spring tickets reuse
these labels and are excluded. The Visionaries forms/member-type work is Sprint 3.

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

Use separate browser profiles for admin and member so switching is quick. Visit
each demo page before presenting to finish the dev server's first compilation.
Do not run `next build` while rehearsing on the same checkout's dev server.

## Recommended walkthrough (about 12 minutes)

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

## Leave out of the website demo

- Shift isolation/capacity/authorization (#278): verified backend behavior, with no
  shift-management UI to present yet.
- Join-request unit coverage (#188): mention as reliability work, not a screen.
- Staging inbox delivery (#256): still open and not verified here.
- Email builder/template selection (#258, #98, #100): not delivered by these sprints.
- Visionaries application forms and member-type gating: Sprint 3 groundwork. The
  seeded application does not establish a working `/forms/camp-application-2027` UI.

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
