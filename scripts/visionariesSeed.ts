import { deflateSync } from "node:zlib";
import { and, eq, inArray, like, notInArray, or, sql } from "drizzle-orm";
import db from "@/lib/db";
import {
  EventVisibility,
  MemberType,
  NotificationType,
  OrganizationConfigKey,
  SubmissionReviewStatus,
  schema,
} from "@/lib/schema";
import type { DashboardLayout } from "@/lib/dashboard/schema";
import type { DashboardHeaderConfig } from "@/lib/dashboard/header";
import type { OrganizationFooter } from "@/lib/footer";
import type { NavbarConfig } from "@/lib/navbar";
import type { FormAnswerValue, FormDefinition } from "@/lib/forms/schema";
import { buildSubmissionSchema } from "@/lib/forms/submission";
import { FileService } from "@/lib/services/FileService";
import { InvitationStatus } from "@/lib/services/InvitationService";
import {
  VISIONARIES_APPLICATION_FORM,
  VISIONARIES_ATTENDEE_FORMS,
  VISIONARIES_DEMO_FORMS,
  visionariesId,
} from "@/tests/unit/fixtures/forms";
import type { SeedOrg } from "./seedTypes";

// ===========================================================================
// Visionaries setup
//
// Visionaries to the Throne is the org Sprints 3 and 4 build against, at
// http://visionariestothethrone.lvh.me:3000. Its config rows are below, and
// seedVisionaries() adds its forms, a test account at each stage of the camp
// process (see docs/VISIONARIES_DEVELOPMENT.md), invitations, camp events,
// and an alert.
// Put new Visionaries config rows and demo data here.
// ===========================================================================

/** Reuse the application workflow with independent IDs for each development tenant. */
export function createApplicationSeed(options: {
  organizationId: string;
  name: string;
  slug: string;
  prefix: string;
  campName: string;
  applicationForm: FormDefinition;
  attendeeForms: FormDefinition[];
  demoForms: FormDefinition[];
  id: (group: number, item: number) => string;
  includeRejected?: boolean;
}) {
  const ORG_ID = options.organizationId;
  const CAMP_NAME = options.campName;
  const VISIONARIES_APPLICATION_FORM = options.applicationForm;
  const VISIONARIES_ATTENDEE_FORMS = options.attendeeForms;
  const VISIONARIES_DEMO_FORMS = options.demoForms;
  const visionariesId = options.id;
  const prefix = options.prefix;

  const APPLICANT_LAYOUT: DashboardLayout = {
    layout: "horizontal",
    widgets: [
      {
        id: "application_status",
        size: "tall",
        config: {
          formId: VISIONARIES_APPLICATION_FORM.formId,
          steps: [
            {
              label: "Submitted",
              description: "Your application has been received.",
            },
            {
              label: "Under Review",
              description: "Our team is reviewing your application.",
            },
            {
              label: "Decision",
              description: "Your camp status will be shared with you.",
            },
          ],
        },
      },
      { id: "notifications", size: "tall" },
    ],
  };

  const ATTENDEE_LAYOUT: DashboardLayout = {
    layout: "horizontal",
    widgets: [
      { id: "forms_todo", size: "small" },
      { id: "weekly_calendar", size: "small" },
      { id: "forms_completed", size: "tall" },
      { id: "forms_progress", size: "small" },
    ],
  };

  // Development copy from the Sprint 3 Figma; Visionaries' real text replaces it.
  const DASHBOARD_HEADER: DashboardHeaderConfig = {
    applicant: {
      title: "Hello, {firstName}!",
      subtitle: `Thanks for applying to ${CAMP_NAME}. Here's where you can track your application and see your next steps.`,
    },
    attendee: {
      title: `My ${CAMP_NAME} Dashboard`,
      subtitle: "Ready for camp? Find all your essentials below.",
      location: "456 Peachtree Avenue, Atlanta, GA 30332",
      dates: "June 2 – Aug 20",
      schedule: "Mon & Wed | 10 AM – 5 PM",
      description:
        "A summer of workshops, mentorship, and community projects for rising leaders.",
    },
  };

  const NAVBAR: NavbarConfig = {
    applicant: { hidden: ["/events"], labels: { "/": "My Application" } },
    attendee: { labels: { "/": "My Camp" } },
  };

  const FOOTER: OrganizationFooter = {
    email: "visionariesttt19@gmail.com",
    ein: "84-4516921",
  };

  const organization: SeedOrg = {
    id: ORG_ID,
    name: options.name,
    slug: options.slug,
    navbar: { variant: "horizontal-center", color: "white" },
    config: {
      // Development defaults from the Figma style guide, not final page designs.
      [OrganizationConfigKey.PrimaryColor]: "#5C218C",
      [OrganizationConfigKey.SecondaryColor]: "#C29BDC",
      [OrganizationConfigKey.BackgroundColor]: "#FFFEF1",
      [OrganizationConfigKey.TextColor]: "#373444",
      [OrganizationConfigKey.DisplayFont]: "fredoka",
      [OrganizationConfigKey.HeadingFont]: "lexend",
      [OrganizationConfigKey.BodyFont]: "lexend",
      [OrganizationConfigKey.CornerStyle]: "pill",
      [OrganizationConfigKey.Tagline]: "Visionaries to the Throne",
      [OrganizationConfigKey.LogoUrl]: "/organizations/visionaries-logo.png",
      [OrganizationConfigKey.FormsEnabled]: "true",
      [OrganizationConfigKey.MemberTypesEnabled]: "true",
      [OrganizationConfigKey.AutoApproveSignups]: "true",
      [OrganizationConfigKey.ApplicantDashboardLayout]:
        JSON.stringify(APPLICANT_LAYOUT),
      [OrganizationConfigKey.AttendeeDashboardLayout]:
        JSON.stringify(ATTENDEE_LAYOUT),
      [OrganizationConfigKey.DashboardHeader]: JSON.stringify(DASHBOARD_HEADER),
      [OrganizationConfigKey.NavbarConfig]: JSON.stringify(NAVBAR),
      [OrganizationConfigKey.OrganizationFooter]: JSON.stringify(FOOTER),
    },
    extraUsers: [
      {
        name: "Applicant User",
        email: "applicant@example.com",
        role: "member",
        phoneNumber: null,
        memberType: MemberType.Applicant,
      },
      {
        name: "Jada Brooks",
        email: "applicant-pending@example.com",
        role: "member",
        phoneNumber: null,
        memberType: MemberType.Applicant,
      },
      {
        name: "Marcus Hill",
        email: "applicant-review@example.com",
        role: "member",
        phoneNumber: null,
        memberType: MemberType.Applicant,
      },
      {
        name: "Aaliyah Grant",
        email: "attendee-complete@example.com",
        role: "member",
        phoneNumber: null,
        memberType: MemberType.Attendee,
      },
    ],
    // The shared member accounts are accepted campers here.
    memberTypes: {
      "member1@example.com": MemberType.Attendee,
      "member2@example.com": MemberType.Attendee,
    },
  };

  // Each test account's place in the camp process: their application's review
  // status (null if they haven't applied) and how many attendee forms they've
  // submitted, in due order.
  const PERSONAS: {
    email: string;
    application: SubmissionReviewStatus | null;
    attendeeForms: number;
  }[] = [
    { email: "applicant@example.com", application: null, attendeeForms: 0 },
    {
      email: "applicant-pending@example.com",
      application: SubmissionReviewStatus.Pending,
      attendeeForms: 0,
    },
    {
      email: "applicant-review@example.com",
      application: SubmissionReviewStatus.UnderReview,
      attendeeForms: 0,
    },
    {
      email: "member2@example.com",
      application: SubmissionReviewStatus.Accepted,
      attendeeForms: 0,
    },
    {
      email: "member1@example.com",
      application: SubmissionReviewStatus.Accepted,
      attendeeForms: 2,
    },
    {
      email: "attendee-complete@example.com",
      application: SubmissionReviewStatus.Accepted,
      attendeeForms: 4,
    },
  ];

  if (options.includeRejected) {
    organization.extraUsers!.push({
      name: "Riley Morgan",
      email: "applicant-rejected@example.com",
      role: "member",
      phoneNumber: null,
      memberType: MemberType.Applicant,
    });
    PERSONAS.push({
      email: "applicant-rejected@example.com",
      application: SubmissionReviewStatus.Rejected,
      attendeeForms: 0,
    });
  }

  const SEEDED_FORMS = [
    VISIONARIES_APPLICATION_FORM,
    ...VISIONARIES_ATTENDEE_FORMS,
  ];

  // Persona i's submission to SEEDED_FORMS[f] is visionariesId(0x10 + i, f);
  // their headshot upload is visionariesId(0x20 + i, 0).
  const submissionId = (persona: number, form: number) =>
    visionariesId(0x10 + persona, form);
  const uploadId = (persona: number) => visionariesId(0x20 + persona, 0);

  const WHY_CAMP = `I want to be a part of this camp because I want to grow as a leader in my school and my community. Last year I started a reading club for younger students, and I learned how much I enjoy helping other people find their confidence. At camp I hope to practice public speaking, learn how to plan projects that make a real difference, and meet other students who care about the same things I do. I also want to get better at working on a team, listening to different ideas, and following through when things get hard. I know this camp will challenge me, and I am ready to give my best effort every day and bring what I learn back home.`;

  /** Inserts a seeded form, or brings an existing seeded copy's details up to date. */
  async function seedForm(form: FormDefinition, createdBy: string) {
    const { components, ...values } = form;
    await db.transaction(async (tx) => {
      // The seeded copy, found by its fixed ID in case a draft's form ID was
      // changed, and any other form using its form ID.
      const matches = await tx
        .select({ id: schema.forms.id })
        .from(schema.forms)
        .where(
          and(
            eq(schema.forms.organizationId, ORG_ID),
            or(
              eq(schema.forms.id, form.id),
              eq(schema.forms.formId, form.formId),
            ),
          ),
        );
      if (matches.some(({ id }) => id !== form.id)) {
        throw new Error(
          `${options.name} already has a form with the ID "${form.formId}" that the seed didn't create. Delete or rename it, then reseed.`,
        );
      }
      if (matches.length > 0) {
        // Questions lock once a form is published, so only its details change.
        await tx
          .update(schema.forms)
          .set({
            formId: values.formId,
            title: values.title,
            description: values.description,
            status: values.status,
            settings: values.settings,
          })
          .where(eq(schema.forms.id, form.id));
        return;
      }

      await tx
        .insert(schema.forms)
        .values({ ...values, organizationId: ORG_ID, createdBy });
      await tx.insert(schema.formComponents).values(
        components.map((component) => ({
          ...component,
          formId: form.id,
          organizationId: ORG_ID,
        })),
      );
    });
  }

  const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });

  function crc32(bytes: Buffer) {
    let crc = 0xffffffff;
    for (const byte of bytes)
      crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  /** A square PNG of one color, standing in for a headshot. */
  function solidPng([r, g, b]: [number, number, number], size = 96) {
    const chunk = (type: string, data: Buffer) => {
      const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
      const length = Buffer.alloc(4);
      length.writeUInt32BE(data.length);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(body));
      return Buffer.concat([length, body, crc]);
    };
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
    const row = Buffer.concat([
      Buffer.from([0]),
      Buffer.alloc(size * 3, Buffer.from([r, g, b])),
    ]);
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(Buffer.concat(Array(size).fill(row)))),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  }

  const HEADSHOT_COLORS: [number, number, number][] = [
    [92, 33, 140],
    [194, 155, 220],
    [125, 82, 161],
    [252, 211, 30],
    [92, 33, 140],
    [125, 82, 161],
  ];

  /**
   * A persona's headshot upload. The file goes through FileService, so it
   * needs file storage configured; without it (e.g. in CI) the row is kept and
   * the image doesn't load.
   */
  async function seedHeadshot(persona: number, userId: string) {
    const id = uploadId(persona);
    const fileName = `seed-headshot-${persona}.png`;
    const png = solidPng(HEADSHOT_COLORS[persona % HEADSHOT_COLORS.length]);
    await db
      .insert(schema.formUploads)
      .values({
        id,
        organizationId: ORG_ID,
        formId: VISIONARIES_APPLICATION_FORM.id,
        uploadedBy: userId,
        fileName,
        contentType: "image/png",
        sizeBytes: png.length,
      })
      .onConflictDoUpdate({
        target: schema.formUploads.id,
        set: { uploadedBy: userId },
        setWhere: and(
          eq(schema.formUploads.organizationId, ORG_ID),
          eq(schema.formUploads.formId, VISIONARIES_APPLICATION_FORM.id),
        ),
      });
    try {
      await FileService.upload(
        { organizationId: ORG_ID, fileName },
        new File([new Uint8Array(png)], fileName, { type: "image/png" }),
      );
    } catch (error) {
      console.warn(
        `Couldn't store a seeded headshot (${error instanceof Error ? error.message : error}); it won't load until file storage is set up.`,
      );
    }
    return id;
  }

  /** A persona's answers to a seeded form, checked against the form. */
  function answersFor(
    form: FormDefinition,
    persona: number,
    person: { name: string; email: string },
    headshot: string,
  ): Record<string, FormAnswerValue> {
    const lastName = person.name.split(" ").at(-1) ?? person.name;
    const parentName = `Taylor ${lastName}`;
    const phone = `404555${String(1000 + persona * 7).padStart(4, "0")}`;
    const byLabel: Record<string, FormAnswerValue> = {
      "Student Name": person.name,
      "Student Number": `00${4210 + persona}`,
      "Student Email": person.email,
      "Parent Name": parentName,
      "Parent Phone Number": phone,
      "Parent Email": `parent.${lastName.toLowerCase()}@example.com`,
      "What grade will the student be headed to during Summer 2027?":
        7 + (persona % 4),
      "Does the camper currently take any medication? (Write N/A if none.)":
        "N/A",
      "Why would you like to be a part of this camp?": WHY_CAMP,
      Headshot: { uploadId: headshot },
      "Contact Name": parentName,
      "Relationship to Camper": "Parent",
      "Contact Phone Number": phone,
      "Contact Email": `parent.${lastName.toLowerCase()}@example.com`,
      "Camper's Full Name": person.name,
      "Parent or Guardian's Full Name": parentName,
      "Does the camper have any allergies? (Write N/A if none.)":
        persona % 2 ? "Peanuts" : "N/A",
      "Today's Date": "10/01/2026",
    };
    const answers = Object.fromEntries(
      form.components.flatMap((component) =>
        component.label in byLabel
          ? [[component.id, byLabel[component.label]]]
          : [],
      ),
    );
    // Keeps the seeded answers in step with the forms' questions.
    return buildSubmissionSchema(form).parse(answers);
  }

  async function seedSubmissions(userIds: Map<string, string>) {
    const people = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
      })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.organizationId, ORG_ID),
          inArray(
            schema.users.id,
            PERSONAS.map(({ email }) => userIds.get(email)!),
          ),
        ),
      );
    const peopleById = new Map(people.map((person) => [person.id, person]));

    for (const [
      persona,
      { email, application, attendeeForms },
    ] of PERSONAS.entries()) {
      const userId = userIds.get(email)!;
      const person = peopleById.get(userId)!;
      const seeded = new Map<string, FormDefinition>();
      if (application) seeded.set(submissionId(persona, 0), SEEDED_FORMS[0]);
      for (let f = 1; f <= attendeeForms; f++) {
        seeded.set(submissionId(persona, f), SEEDED_FORMS[f]);
      }

      // Reset the account to its seeded state: drop responses added while
      // testing and restore the seeded ones' answers and review status.
      await db.delete(schema.formSubmissions).where(
        and(
          eq(schema.formSubmissions.organizationId, ORG_ID),
          eq(schema.formSubmissions.userId, userId),
          inArray(
            schema.formSubmissions.formId,
            SEEDED_FORMS.map((form) => form.id),
          ),
          ...(seeded.size
            ? [notInArray(schema.formSubmissions.id, [...seeded.keys()])]
            : []),
        ),
      );
      if (seeded.size === 0) continue;

      const headshot = await seedHeadshot(persona, userId);
      for (const [id, form] of seeded) {
        const reviewStatus =
          form.id === VISIONARIES_APPLICATION_FORM.id
            ? application!
            : SubmissionReviewStatus.Pending;
        const submittedAt = new Date(
          Date.UTC(2026, 9, 1 + persona, 14) +
            SEEDED_FORMS.indexOf(form) * 864e5,
        );
        await db
          .insert(schema.formSubmissions)
          .values({
            id,
            formId: form.id,
            organizationId: ORG_ID,
            userId,
            submittedAt,
            reviewStatus,
          })
          .onConflictDoUpdate({
            target: schema.formSubmissions.id,
            set: {
              userId,
              reviewStatus,
              updatedAt: null,
              reviewStatusUpdatedAt: null,
              reviewStatusUpdatedBy: null,
            },
            setWhere: and(
              eq(schema.formSubmissions.organizationId, ORG_ID),
              eq(schema.formSubmissions.formId, form.id),
            ),
          });
        await db
          .delete(schema.formAnswers)
          .where(eq(schema.formAnswers.submissionId, id));
        await db.insert(schema.formAnswers).values(
          Object.entries(answersFor(form, persona, person, headshot)).map(
            ([componentId, value]) => ({
              formId: form.id,
              submissionId: id,
              componentId,
              value,
            }),
          ),
        );
      }
    }
  }

  /**
   * Seeds the draft and closed demo forms. Their responses only come from trying
   * them out, so they're deleted, and each form goes back to its seeded status.
   */
  async function seedDemoForms(createdBy: string) {
    for (const form of VISIONARIES_DEMO_FORMS) {
      await db
        .delete(schema.formSubmissions)
        .where(
          and(
            eq(schema.formSubmissions.organizationId, ORG_ID),
            eq(schema.formSubmissions.formId, form.id),
          ),
        );
      await seedForm(form, createdBy);
    }
  }

  // Links to the accept-invitation page, one for each state it shows. The IDs
  // are the links' tokens, fixed so the links are too.
  const INVITATIONS = [
    // No account yet, so the page asks them to create one.
    {
      id: `${prefix}-invite-counselor`,
      email: "counselor@example.com",
      name: "Jordan Reed",
      role: "admin",
      expired: false,
    },
    // An account that isn't a member, so the page asks them to log in.
    {
      id: `${prefix}-invite-nonmember`,
      email: "nonmember@example.com",
      name: "Non Member",
      role: "member",
      expired: false,
    },
    {
      id: `${prefix}-invite-expired`,
      email: "expired-invite@example.com",
      name: "Sam Lee",
      role: "member",
      expired: true,
    },
  ];

  /**
   * Seeds the invitations as pending, undoing any acceptance from a previous
   * run so each link works again: an account created from an invitation is
   * deleted, and a membership an existing account gained is removed.
   */
  async function seedInvitations(userIds: Map<string, string>, now: Date) {
    for (const { expired, ...invitation } of INVITATIONS) {
      const seededUserId = userIds.get(invitation.email);
      if (seededUserId) {
        await db
          .delete(schema.members)
          .where(
            and(
              eq(schema.members.userId, seededUserId),
              eq(schema.members.organizationId, ORG_ID),
            ),
          );
      } else {
        await db
          .delete(schema.users)
          .where(
            and(
              eq(schema.users.email, invitation.email),
              eq(schema.users.organizationId, ORG_ID),
            ),
          );
      }

      const values = {
        ...invitation,
        inviterId: userIds.get("admin@example.com")!,
        organizationId: ORG_ID,
        status: InvitationStatus.Pending,
        expiresAt: new Date(now.getTime() + (expired ? -1 : 30) * 864e5),
      };
      await db
        .insert(schema.invitations)
        .values(values)
        .onConflictDoUpdate({ target: schema.invitations.id, set: values });
    }
  }

  /** Monday at midnight of the week `date` falls in, in local time. */
  function startOfWeek(date: Date) {
    const monday = new Date(date);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return monday;
  }

  function atLocalTime(monday: Date, dayOffset: number, hour: number) {
    const date = new Date(monday);
    date.setDate(date.getDate() + dayOffset);
    date.setHours(hour);
    return date;
  }

  // This week's and next week's camp days, dated from when the seed runs so the
  // weekly calendar always has something to show.
  async function seedEvents(now: Date) {
    const monday = startOfWeek(now);
    const location = "456 Peachtree Avenue, Atlanta, GA 30332";
    const camp = [
      [0, 10, "7 hours", "Camp Day: Leadership Workshop"],
      [2, 10, "7 hours", "Camp Day: Public Speaking"],
      [7, 10, "7 hours", "Camp Day: Community Project Kickoff"],
      [9, 10, "7 hours", "Camp Day: Mentorship Circles"],
      [11, 13, "2 hours", "Family Showcase"],
    ] as const;

    for (const [index, [day, hour, duration, name]] of camp.entries()) {
      const values = {
        id: `event_${prefix}_${index + 1}`,
        organizationId: ORG_ID,
        name,
        location,
        description: `${name} at ${CAMP_NAME}.`,
        startTimestamp: atLocalTime(monday, day, hour),
        duration,
        coverImageUrl: null,
        visibility: EventVisibility.Member,
        publishedAt: now,
      };
      await db
        .insert(schema.events)
        .values(values)
        .onConflictDoUpdate({
          target: schema.events.id,
          set: {
            name: values.name,
            description: values.description,
            startTimestamp: values.startTimestamp,
            duration: values.duration,
            visibility: values.visibility,
            publishedAt: values.publishedAt,
          },
        });
    }
  }

  // An unread alert for every accepted camper, reset to unread on each seed.
  async function seedAlert(userIds: Map<string, string>, now: Date) {
    const cancelled = atLocalTime(startOfWeek(now), 9, 10);
    const day = cancelled.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const text = `Camp will be cancelled on ${day} due to inclement weather. We'll resume regular hours the next camp day.`;
    for (const { email } of PERSONAS.filter(
      ({ application }) => application === SubmissionReviewStatus.Accepted,
    )) {
      const userId = userIds.get(email)!;
      await db
        .insert(schema.notifications)
        .values({
          id: `notif_${prefix}_alert_${userId}`,
          userId,
          organizationId: ORG_ID,
          type: NotificationType.Announcement,
          text,
          read: false,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: schema.notifications.id,
          set: { text, read: false, createdAt: now },
        });
    }
  }

  /**
   * Removes requests to complete a seeded form that admins sent the test
   * accounts (#317), so they can be asked again.
   */
  async function resetInformationRequests(userIds: Map<string, string>) {
    await db.delete(schema.notifications).where(
      and(
        eq(schema.notifications.organizationId, ORG_ID),
        inArray(
          schema.notifications.userId,
          PERSONAS.map(({ email }) => userIds.get(email)!),
        ),
        inArray(
          sql<string>`${schema.notifications.metadata}->>'informationRequestFormId'`,
          SEEDED_FORMS.map(({ id }) => id),
        ),
      ),
    );
  }

  /** Removes the generic sample notifications earlier seeds gave Visionaries. */
  async function removeGenericVisionariesNotifications() {
    await db
      .delete(schema.notifications)
      .where(like(schema.notifications.id, `notif_${ORG_ID}_%`));
  }

  /**
   * Seeds Visionaries' forms, test accounts' responses, invitations, camp
   * events, and alert. `userIds` maps each Visionaries account's email to its
   * user ID.
   */
  async function seedVisionaries(userIds: Map<string, string>) {
    const now = new Date();
    const admin = userIds.get("admin@example.com")!;
    for (const form of SEEDED_FORMS) {
      await seedForm(form, admin);
    }
    await seedSubmissions(userIds);
    await seedDemoForms(admin);
    await seedInvitations(userIds, now);
    await seedEvents(now);
    await seedAlert(userIds, now);
    await resetInformationRequests(userIds);
    await removeGenericVisionariesNotifications();
  }

  return {
    organization,
    seed: seedVisionaries,
    removeGenericNotifications: removeGenericVisionariesNotifications,
  };
}

const visionaries = createApplicationSeed({
  organizationId: "org_visionariestothethrone",
  name: "Visionaries to the Throne",
  slug: "visionariestothethrone",
  prefix: "visionaries",
  campName: "Building Your Throne Summer 2027",
  applicationForm: VISIONARIES_APPLICATION_FORM,
  attendeeForms: VISIONARIES_ATTENDEE_FORMS,
  demoForms: VISIONARIES_DEMO_FORMS,
  id: visionariesId,
});
export const VISIONARIES_ORG = visionaries.organization;
export const seedVisionaries = visionaries.seed;
export const removeGenericVisionariesNotifications =
  visionaries.removeGenericNotifications;
