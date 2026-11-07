# Glossary

One name for each thing in ServiceStart. New code, UI copy, tickets, and
reviews use the term in bold. Code older than this list sometimes uses another
name, listed as "In code". Don't rename those in bulk: switch to the glossary
term when you're already editing that code.

## People and organizations

**Organization.** One nonprofit's deployment of ServiceStart: the tenant.
Every user-facing row belongs to one. It's found from the host's subdomain
(`<slug>.<root domain>`) or, on the default host, from the session's active
organization.
_In code:_ org, tenant, `organizations`, `activeOrganizationId`.

**Member.** A user's membership in one organization. The same email can be a
different member, with a different user row, in each organization.
_In code:_ `members`. (`user_organizations` is an older join table that
nothing uses.)

**Role.** What a member may do in their organization: `owner`, `admin`, or
`member`. Access checks treat owners as admins (`requireAdmin`).
_In code:_ `members.role`.

**Member type.** A kind of non-admin member that an organization defines, such
as Visionaries' applicants and current attendees. Each organization has its
own (`member_types`), and a member has at most one, by its key. Member types
only count while the organization has `MemberTypesEnabled` on.
_In code:_ the `MemberType` enum and the strings `"applicant"` and
`"attendee"`, until #336.

**Audience.** Who a dashboard, its header, and the navbar are for: admins,
members without a type, or one member type.
_In code:_ `DashboardAudience`.

## Configuration

**Config key.** One per-organization setting, stored as a row in
`organization_config`, with a default when there's no row.
_In code:_ `OrganizationConfigKey`, organization config.

**Feature toggle.** A boolean config key that turns a feature on for one
organization. Features are built for everyone and default to off. Pages and
routes enforce the toggle on the server (`notFoundIfFeatureDisabled`,
`assertFeatureEnabled`); hiding the nav item isn't enough.
_In code:_ `ToggleableOrganizationFeature`, `requireConfig`, the `…Enabled`
keys.

## Forms

**Form.** A set of questions an organization publishes for its members, or
anyone, to fill out. It's a draft, published, or closed.
_In code:_ `forms`. `forms.formId` is the readable key in URLs, and `forms.id`
is the UUID other tables reference.

**Question.** One item on a form: a question of some type, or a section
header.
_In code:_ component, form component, `form_components`.

**Response.** One person's answers to a form, once they submit it. A draft
(#338) is a response that hasn't been submitted yet.
_In code:_ submission, `form_submissions`, `FormSubmissionService`. Its
answers are in `form_answers`; drafts are in `form_response_drafts`.

**Review status.** Where an admin's review of a response stands: pending,
under review, accepted, or rejected. Accepting a response can change the
member's type.
_In code:_ `SubmissionReviewStatus`, `reviewStatus`.

**Information request.** An admin asking a member to fill out a form. The
member gets an action-required notification that links to it.
_In code:_ `InformationRequestService`.

## Communications

**Notification.** An item in one member's inbox, with a type such as general,
announcement, or action required. The bell counts the unread ones.
_In code:_ `notifications`, inbox.

**Alert.** A notice an admin posts to members' dashboards, optionally for some
member types only. It's sent as an announcement-type notification and shown
as a banner until it's dismissed.
_In code:_ dashboard alert, `POST /api/alerts`, `DashboardAlertBanner`.

**Announcement.** A newsletter-style post with a subject and content. It's a
draft until it's published, and can be saved as a template.
_In code:_ `announcements`, newsletter.

**Message.** An admin's message to some or all members, stored with its
recipients and emailed to them.
_In code:_ `messages`, `message_recipients`.

**Email.** An email sent through Juno. Admins email selected members from the
members table; these emails aren't stored.
_In code:_ `EmailService`, `POST /api/emails`.

## Events

**Event.** Something an organization holds at a time and place, public or for
members only. It's a draft until it's published.
_In code:_ `events`.

**Shift.** A time slot within an event that members RSVP to separately, such
as one volunteer slot.
_In code:_ `shifts`.

**RSVP.** A member saying they'll attend an event or work a shift. Events and
shifts can cap their RSVPs.
_In code:_ register, `event_rsvps`, `shift_rsvps`, `shiftRSVPs`.

## Dashboards

**Widget.** One card on a dashboard, such as Events or the To-Do List. Each
widget lives in the context whose data it shows, and some take settings.
_In code:_ `WIDGET_REGISTRY`, `WidgetId`.

**Layout.** Which widgets a dashboard shows, their order and sizes, and the
direction they flow. Each audience can have its own. Member types without one
get the members' layout.
_In code:_ dashboard layout, `DashboardLayout`, and the
`AdminDashboardLayout`, `DashboardLayout`, and `MemberTypeDashboardLayouts`
config keys.
