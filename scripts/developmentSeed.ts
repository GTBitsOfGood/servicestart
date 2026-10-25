import { and, eq, inArray, sql } from "drizzle-orm";
import db from "@/lib/db";
import {
  EventVisibility,
  FormComponentType,
  FormStatus,
  JoinRequestStatus,
  NotificationType,
  OrganizationConfigKey as Key,
  schema,
} from "@/lib/schema";
import { DEFAULT_FORM_SETTINGS } from "@/lib/forms/constants";
import type { FormDefinition } from "@/lib/forms/schema";
import {
  VISIONARIES_APPLICATION_FORM,
  VISIONARIES_ATTENDEE_FORMS,
  VISIONARIES_DEMO_FORMS,
} from "@/tests/unit/fixtures/forms";
import { createApplicationSeed } from "./visionariesSeed";
import type { SeedOrg } from "./seedTypes";

const DAY = 864e5;
const future = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString();
const applicationId = (group: number, item: number) =>
  `a9911ca7-7a2b-4c1d-9e8f-${(group * 0x1000 + item).toString(16).padStart(12, "0")}`;

// Independent copies exercise the same form keys on different tenants. Rolling
// deadlines keep these development fixtures usable after the current semester.
function applicationForm(
  source: FormDefinition,
  group: number,
): FormDefinition {
  const form: FormDefinition = JSON.parse(
    JSON.stringify(source)
      .replaceAll("Visionaries to the Throne", "ApplicationStart")
      .replaceAll("Building Your Throne Summer 2027", "Leadership Camp")
      .replaceAll("Summer Camp 2027", "Leadership Camp"),
  );
  return {
    ...form,
    id: applicationId(group, 0),
    settings: {
      ...form.settings,
      dueAt: form.settings.dueAt ? future(30 + group * 7) : null,
      closesAt: form.settings.closesAt ? future(90) : null,
    },
    components: form.components.map((component, index) => ({
      ...component,
      id: applicationId(group, index + 1),
    })),
  };
}

const application = createApplicationSeed({
  organizationId: "org_applicationstart",
  name: "ApplicationStart",
  slug: "applicationstart",
  prefix: "applicationstart",
  campName: "Leadership Camp",
  applicationForm: applicationForm(VISIONARIES_APPLICATION_FORM, 0),
  attendeeForms: VISIONARIES_ATTENDEE_FORMS.map((form, index) =>
    applicationForm(form, index + 1),
  ),
  demoForms: VISIONARIES_DEMO_FORMS.map((form, index) =>
    applicationForm(form, index + 5),
  ),
  id: applicationId,
  includeRejected: true,
});

export const APPLICATION_ORG: SeedOrg = {
  ...application.organization,
  config: {
    ...application.organization.config,
    [Key.Tagline]: "Applications, decisions, and next steps.",
    [Key.LogoUrl]: "/bog.svg",
    [Key.OrganizationFooter]: JSON.stringify({
      email: "staff@applicationstart.example.com",
      ein: "00-0000000",
    }),
  },
};
export const seedApplicationStart = application.seed;

export const VOLUNTEER_ORG: SeedOrg = {
  id: "org_volunteerstart",
  name: "VolunteerStart",
  slug: "volunteerstart",
  navbar: { variant: "horizontal-left", color: "white" },
  config: {
    [Key.PrimaryColor]: "#0F766E",
    [Key.SecondaryColor]: "#D97706",
    [Key.BackgroundColor]: "#F0FDFA",
    [Key.TextColor]: "#134E4A",
    [Key.DisplayFont]: "visby",
    [Key.HeadingFont]: "visby",
    [Key.BodyFont]: "open-sans",
    [Key.CornerStyle]: "square",
    [Key.Tagline]: "Small acts. Stronger communities.",
    [Key.LogoUrl]: "/bog.svg",
    [Key.FormsEnabled]: "true",
    [Key.MembersPageEnabled]: "true",
    [Key.MemberTypesEnabled]: "false",
    [Key.AutoApproveSignups]: "false",
    [Key.DashboardLayout]: JSON.stringify({
      layout: "vertical",
      widgets: [
        { id: "events", size: "tall" },
        { id: "notifications", size: "tall" },
      ],
    }),
    [Key.AdminDashboardLayout]: JSON.stringify({
      layout: "horizontal",
      widgets: [
        { id: "member_requests", size: "tall" },
        { id: "events", size: "tall" },
        { id: "notifications", size: "small" },
      ],
    }),
    [Key.DashboardHeader]: JSON.stringify({
      default: {
        title: "Welcome, {firstName}!",
        subtitle: "Find your next opportunity to help.",
        description:
          "Join a neighborhood cleanup, pack meals, or help at our community garden.",
      },
    }),
    [Key.OrganizationFooter]: JSON.stringify({
      email: "hello@volunteerstart.example.com",
      ein: "00-0000000",
    }),
  },
};

const volunteerId = (group: number, item: number) =>
  `701a17ee-7a2b-4c1d-9e8f-${(group * 0x1000 + item).toString(16).padStart(12, "0")}`;
export const VOLUNTEER_FORMS: FormDefinition[] = [
  ["volunteer-interest", "Volunteer Interest", FormStatus.Published],
  ["volunteer-feedback", "Volunteer Feedback", FormStatus.Draft],
  ["orientation-rsvp", "Orientation RSVP", FormStatus.Closed],
].map(
  ([formId, title, status], group): FormDefinition => ({
    id: volunteerId(group, 0),
    formId,
    title,
    status: status as FormStatus,
    description:
      "Tell the VolunteerStart team how you would like to get involved.",
    settings: { ...DEFAULT_FORM_SETTINGS },
    components: [
      {
        id: volunteerId(group, 1),
        position: 0,
        type: FormComponentType.ShortText,
        label: "Full Name",
        required: true,
        helpText: null,
        config: {},
      },
      {
        id: volunteerId(group, 2),
        position: 1,
        type: FormComponentType.Email,
        label: "Email",
        required: true,
        helpText: null,
        config: {},
      },
      {
        id: volunteerId(group, 3),
        position: 2,
        type: FormComponentType.LongText,
        label: "How would you like to help?",
        required: false,
        helpText: null,
        config: { maxWords: 100 },
      },
    ],
  }),
);

/** Resets only documented fixtures; developer-created forms/events are retained. */
export async function seedVolunteerStart(userIds: Map<string, string>) {
  const orgId = VOLUNTEER_ORG.id;
  const now = new Date();
  const admin = userIds.get("admin@example.com")!;
  await db.transaction(async (tx) => {
    for (const form of VOLUNTEER_FORMS) {
      const { components, ...values } = form;
      // Refuse to take over a developer-created form with a matching URL key.
      const matches = await tx
        .select()
        .from(schema.forms)
        .where(
          and(
            eq(schema.forms.organizationId, orgId),
            eq(schema.forms.formId, form.formId),
          ),
        );
      if (matches.some((match) => match.id !== form.id))
        throw new Error(
          `VolunteerStart form key "${form.formId}" is already in use; rename it before reseeding.`,
        );
      await tx
        .delete(schema.forms)
        .where(
          and(
            eq(schema.forms.organizationId, orgId),
            eq(schema.forms.id, form.id),
          ),
        );
      await tx
        .insert(schema.forms)
        .values({ ...values, organizationId: orgId, createdBy: admin });
      await tx.insert(schema.formComponents).values(
        components.map((component) => ({
          ...component,
          organizationId: orgId,
          formId: form.id,
        })),
      );
    }
    const userId = userIds.get("member1@example.com")!;
    const submissionId = volunteerId(10, 0);
    const form = VOLUNTEER_FORMS[0];
    await tx.insert(schema.formSubmissions).values({
      id: submissionId,
      formId: form.id,
      organizationId: orgId,
      userId,
      submittedAt: now,
    });
    await tx.insert(schema.formAnswers).values([
      {
        submissionId,
        formId: form.id,
        componentId: form.components[0].id,
        value: "Member One",
      },
      {
        submissionId,
        formId: form.id,
        componentId: form.components[1].id,
        value: "member1@example.com",
      },
      {
        submissionId,
        formId: form.id,
        componentId: form.components[2].id,
        value: "I can help with weekend cleanups and meal packing.",
      },
    ]);
  });

  // Two future public events, a member event, a past event, and an editable draft.
  for (const [index, [name, days, published, visibility]] of [
    ["Community Park Cleanup", 7, true, EventVisibility.Public],
    ["Meal Packing Morning", 14, true, EventVisibility.Public],
    ["Volunteer Orientation", 3, true, EventVisibility.Member],
    ["Community Garden Day", -7, true, EventVisibility.Public],
    ["Neighborhood Supply Drive", 21, false, EventVisibility.Public],
  ].entries()) {
    const eventId = `event_volunteerstart_${index + 1}`;
    const startTimestamp = new Date(now.getTime() + Number(days) * DAY);
    startTimestamp.setHours(10, 0, 0, 0);
    const values = {
      id: eventId,
      organizationId: orgId,
      name: String(name),
      location: "123 Community Way, Atlanta, GA 30332",
      description:
        "Help our neighbors alongside the VolunteerStart team. Supplies and orientation provided.",
      startTimestamp,
      duration: "2 hours",
      visibility: visibility as EventVisibility,
      publishedAt: published ? now : null,
      rsvpLimit: 12,
    };
    await db
      .insert(schema.events)
      .values(values)
      .onConflictDoUpdate({ target: schema.events.id, set: values });
    if (index === 0) {
      await db
        .delete(schema.eventRsvps)
        .where(eq(schema.eventRsvps.eventId, eventId));
      await db
        .insert(schema.eventRsvps)
        .values({ eventId, userId: userIds.get("member1@example.com")! });
      const tagId = "tag_volunteerstart_cleanup";
      await db
        .insert(schema.tags)
        .values({ tagId, organizationId: orgId, tag: "Cleanup" })
        .onConflictDoNothing();
      await db
        .insert(schema.eventTags)
        .values({ tagId, eventId })
        .onConflictDoNothing();
      for (let shift = 0; shift < 2; shift++) {
        const id = `shift_volunteerstart_${shift + 1}`;
        const values = {
          id,
          organizationId: orgId,
          eventId,
          name: shift ? "Cleanup crew" : "Setup crew",
          description: "Meet at the park entrance.",
          startTimestamp: new Date(startTimestamp.getTime() + shift * 3600e3),
          duration: "1 hour",
          rsvpLimit: shift ? 4 : 1,
        };
        await db
          .insert(schema.shifts)
          .values(values)
          .onConflictDoUpdate({ target: schema.shifts.id, set: values });
        await db
          .delete(schema.shiftRSVPs)
          .where(eq(schema.shiftRSVPs.shiftId, id));
        if (!shift)
          await db.insert(schema.shiftRSVPs).values({
            shiftId: id,
            userId: userIds.get("member1@example.com")!,
          });
      }
    }
  }

  for (const status of Object.values(JoinRequestStatus)) {
    const userId = userIds.get(`joinrequest-${status}@example.com`)!;
    const id = `jr_${status}_volunteerstart`;
    // Reset history only for these three dedicated request personas.
    const requests = await db
      .select({ id: schema.joinRequests.id })
      .from(schema.joinRequests)
      .where(
        and(
          eq(schema.joinRequests.organizationId, orgId),
          eq(schema.joinRequests.userId, userId),
        ),
      );
    if (requests.length) {
      await db.delete(schema.notifications).where(
        and(
          eq(schema.notifications.organizationId, orgId),
          inArray(
            sql<string>`${schema.notifications.metadata}->>'joinRequestId'`,
            requests.map((request) => request.id),
          ),
        ),
      );
      await db.delete(schema.joinRequests).where(
        inArray(
          schema.joinRequests.id,
          requests.map((request) => request.id),
        ),
      );
    }
    await db
      .delete(schema.members)
      .where(
        and(
          eq(schema.members.organizationId, orgId),
          eq(schema.members.userId, userId),
        ),
      );
    await db.insert(schema.joinRequests).values({
      id,
      organizationId: orgId,
      userId,
      status,
      denialReason:
        status === JoinRequestStatus.Denied
          ? "Please contact the coordinator before reapplying."
          : null,
    });
    if (status === JoinRequestStatus.Approved)
      await db.insert(schema.members).values({
        id: `member_${userId}_${orgId}`,
        organizationId: orgId,
        userId,
        role: "member",
      });
  }

  for (const [index, email] of [
    "admin@example.com",
    "member1@example.com",
    "member2@example.com",
  ].entries()) {
    const userId = userIds.get(email)!;
    for (const [n, text] of [
      "Welcome to VolunteerStart! Volunteer opportunities are now open.",
      "The cleanup supply list has been updated. Check the event before attending.",
    ].entries()) {
      const values = {
        id: `notif_volunteerstart_${index}_${n}`,
        organizationId: orgId,
        userId,
        text,
        type: NotificationType.Announcement,
        read: n === 0,
        createdAt: now,
      };
      await db
        .insert(schema.notifications)
        .values(values)
        .onConflictDoUpdate({ target: schema.notifications.id, set: values });
    }
  }
  for (const expired of [false, true]) {
    const values = {
      id: `volunteerstart-invite-${expired ? "expired" : "nonmember"}`,
      organizationId: orgId,
      inviterId: admin,
      email: expired ? "expired-invite@example.com" : "nonmember@example.com",
      name: expired ? "Expired Invitation" : "Non Member",
      role: "member",
      status: "pending",
      expiresAt: new Date(now.getTime() + (expired ? -1 : 30) * DAY),
    };
    // A repeatable existing-account invitation.
    if (!expired)
      await db
        .delete(schema.members)
        .where(
          and(
            eq(schema.members.organizationId, orgId),
            eq(schema.members.userId, userIds.get("nonmember@example.com")!),
          ),
        );
    await db
      .insert(schema.invitations)
      .values(values)
      .onConflictDoUpdate({ target: schema.invitations.id, set: values });
  }
}
