# Email sender DNS and staging verification

Email setup (`pnpm run email:setup`, also called by `setupOrg`) saves the
provider's domain ID and DNS records to `docs/email-dns/<domain>-<unique-id>.json`. It fails
if that file cannot be written. The file contains no API keys. Run from the
repository root; review and commit the real staging domain's JSON after setup.
Each run creates a separate snapshot, so simulated local setup cannot overwrite
previously recorded live DNS records. Commit only reviewed live snapshots.

Default local Juno simulates SendGrid. Its records are not usable DNS records.
A saved response, an HTTP success, or a SendGrid acceptance is not evidence of
inbox delivery. Confirm that the selected Juno environment uses live SendGrid
before publishing any records. Use the exact `host`, `type`, and `data` values
returned by that environment; do not invent DKIM or CNAME targets. Validate the
domain in SendGrid after the DNS changes propagate.

## Staging verification record — 2026-09-14

Status: **blocked on staging access; no test email sent or inbox delivery
confirmed in this run**. This record supports issue #256; it does not close it.

The repository's latest GitHub Staging deployment was successful at commit
`362eb565f76ab176f2e1773f69a08ce2b3f530d2`. Its GitHub deployment status did not
provide an environment URL. `https://servicestart.netlify.app` was reachable and
redirected `/` to `/login`, but the two tenant hosts and their admin access have
not been established. Local `.env` does not define `EMAIL_SENDER_DOMAIN`.
No live domain registration response is available to commit yet.

Test recipient authorized for this run: `dawsomegu@gmail.com`.

| Flow                                     | First organization | Second organization |
| ---------------------------------------- | ------------------ | ------------------- |
| Member email (`api/emails.ts`)           | Not run            | Not run             |
| Announcement (`api/announcements.ts`)    | Not run            | Not run             |
| Message (`MessageService.createAndSend`) | Not run            | Not run             |
| Invitation (BetterAuth)                  | Not run            | Not run             |
| Password reset (BetterAuth)              | Not run            | Not run             |

For each cell, record tenant slug and host, staging commit, UTC send time,
subject marker, sender address, request/provider result, and inbox or spam
outcome. Keep invitation and reset tokens, credentials, and unrelated member
addresses out of the record.

Use two isolated test organizations containing only the authorized recipient.
Announcements and messages can target multiple members; do not use an existing
organization's full membership for this test. Exercise each actual application
flow, not just a direct Juno send. Request a password reset for the test account
in each tenant without completing the reset. Each expected sender is
`<org-slug>@mail.<EMAIL_SENDER_DOMAIN>`.

Before completing #256:

- Establish both staging tenant hosts, test-account admin access, live Juno
  configuration, and the sender domain's DNS access.
- Run setup against that environment, commit the returned real DNS snapshot,
  and validate its records with SendGrid.
- Exercise all ten flow/organization combinations and confirm arrival or spam
  placement in the authorized inbox.
- Replace the unrun results above with evidence and record the results on #256.

Missing email configuration fails explicitly through `lib/env.ts` and the
sending/setup changes in #267, on which this work depends. Automated setup
checks cover missing values, normalized domains, DNS persistence, and write
failure propagation. These checks do not substitute for staging delivery.
