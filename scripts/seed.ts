import "dotenv/config"; //must be first to load environment variables
import { randomUUID } from "node:crypto";
import { EventVisibility, JoinRequestStatus, schema } from "../lib/schema";
import db from "../lib/db";
import { auth } from "@/lib/auth";
import { OrganizationConfigKey, NotificationType } from "@/lib/schema";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { DEFAULT_TEST_PASSWORD } from "@/tests/unit/testUtils";
import { and, eq, isNull } from "drizzle-orm";

const isTest = require.main !== module; // Check if the script is being run directly or imported in tests

function log(...args: unknown[]) {
  if (!isTest) {
    console.log(...args);
  }
}

type NavbarConfig = {
  variant: string;
  color: string;
};

const ORGS: Array<{
  id: string;
  name: string;
  slug: string;
  navbar: NavbarConfig;
}> = [
  {
    id: "org_servicestart",
    name: "ServiceStart",
    slug: "servicestart",
    navbar: { variant: "horizontal-center", color: "red" },
  },
  {
    id: "org_vertical_icon",
    name: "Vertical Icon Org",
    slug: "vertical-icon",
    navbar: { variant: "vertical-icon", color: "white" },
  },
  {
    id: "org_horizontal_left",
    name: "Horizontal Left Org",
    slug: "horizontal-left",
    navbar: { variant: "horizontal-left", color: "red" },
  },
  {
    id: "org_horizontal_center",
    name: "Horizontal Center Org",
    slug: "horizontal-center",
    navbar: { variant: "horizontal-center", color: "white" },
  },
];

export async function main() {
  log("Seeding database...");

  for (const org of ORGS) {
    await db
      .insert(schema.organizations)
      .values({
        id: org.id,
        name: org.name,
        slug: org.slug,
      })
      .onConflictDoNothing();

    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.NavbarVariant,
      org.navbar.variant,
    );
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.NavbarColor,
      org.navbar.color,
    );
  }

  log("Organizations created with navbar configs.");

  const usersData = [
    {
      name: "Owner User",
      email: "owner@example.com",
      role: "owner",
      phoneNumber: null,
    },
    {
      name: "Admin User",
      email: "admin@example.com",
      role: "admin",
      phoneNumber: "(666) 666-6666",
    },
    {
      name: "Member One",
      email: "member1@example.com",
      role: "member",
      phoneNumber: null,
    },
    {
      name: "Member Two",
      email: "member2@example.com",
      role: "member",
      phoneNumber: null,
    },
    {
      name: "Non Member",
      email: "nonmember@example.com",
      role: null,
      phoneNumber: null,
    },
    {
      name: "Join Request Pending",
      email: "joinrequest-pending@example.com",
      role: null,
      phoneNumber: null,
    },
    {
      name: "Join Request Approved",
      email: "joinrequest-approved@example.com",
      role: null,
      phoneNumber: null,
    },
    {
      name: "Join Request Denied",
      email: "joinrequest-denied@example.com",
      role: null,
      phoneNumber: null,
    },
  ];

  const userIdsByEmail = new Map<string, string>();
  const userIdsByOrganization = new Map<string, Map<string, string>>();

  for (const org of ORGS) {
    const orgUserIds = new Map<string, string>();
    userIdsByOrganization.set(org.id, orgUserIds);
    for (const userData of usersData) {
      let [user] = await db
        .select()
        .from(schema.users)
        .where(
          and(
            eq(schema.users.email, userData.email),
            eq(schema.users.organizationId, org.id),
          ),
        );

      // Preserve IDs, credentials, and related data from the old unscoped seed.
      // Only adopt matching seed identities into the default organization.
      if (!user && org.id === "org_servicestart") {
        const legacy = await db
          .select()
          .from(schema.users)
          .where(
            and(
              eq(schema.users.email, userData.email),
              eq(schema.users.name, userData.name),
              isNull(schema.users.organizationId),
            ),
          );
        if (legacy.length > 1) {
          throw new Error(
            `Multiple unscoped seed accounts for ${userData.email}; resolve them before seeding.`,
          );
        }
        if (legacy.length === 1) {
          [user] = await db
            .update(schema.users)
            .set({ organizationId: org.id })
            .where(eq(schema.users.id, legacy[0].id))
            .returning();
        }
      }

      let userId = user?.id;
      if (!userId) {
        const res = await auth.api.signUpEmail({
          headers: new Headers({
            "x-organization-slug": org.slug,
            host: `${org.slug}.lvh.me:3000`,
          }),
          body: {
            email: userData.email,
            password: DEFAULT_TEST_PASSWORD,
            name: userData.name,
            phoneNumber: userData.phoneNumber,
          },
        });
        userId = res.user.id;
      }
      orgUserIds.set(userData.email, userId);
      if (org.id === "org_servicestart")
        userIdsByEmail.set(userData.email, userId);

      if (userData.role) {
        await db
          .insert(schema.members)
          .values({
            id: `member_${userId}_${org.id}`,
            userId,
            organizationId: org.id,
            role: userData.role,
          })
          .onConflictDoNothing();
      }
    }
  }

  log("Users and members created.");
  const joinRequestSeedData = [
    {
      id: "jr_pending_servicestart",
      email: "joinrequest-pending@example.com",
      status: JoinRequestStatus.Pending,
      createdAt: new Date("2026-02-25T15:00:00"),
    },
    {
      id: "jr_approved_servicestart",
      email: "joinrequest-approved@example.com",
      status: JoinRequestStatus.Approved,
      createdAt: new Date("2026-02-25T15:00:00"),
    },
    {
      id: "jr_denied_servicestart",
      email: "joinrequest-denied@example.com",
      status: JoinRequestStatus.Denied,
      createdAt: new Date("2026-02-25T15:00:00"),
    },
  ];

  for (const joinRequest of joinRequestSeedData) {
    const userId = userIdsByEmail.get(joinRequest.email);

    if (!userId) {
      throw new Error(`Missing seeded user for ${joinRequest.email}`);
    }

    await db
      .insert(schema.joinRequests)
      .values({
        id: joinRequest.id,
        userId,
        organizationId: "org_servicestart",
        status: joinRequest.status,
        createdAt: joinRequest.createdAt,
      })
      .onConflictDoNothing();
  }

  log("Join requests created for pending, approved, and denied states.");
  log(
    "Seed accounts use password123. Sign in at localhost:3000 for ServiceStart or <org-slug>.lvh.me:3000 for vertical-icon, horizontal-left, or horizontal-center. Each organization has separate accounts.",
  );

  const orgId = "org_servicestart";

  const eventsData = [
    {
      id: "event_001",
      organizationId: orgId,
      name: "Event 1",
      location: "Georgia Tech",
      description: "Event description 1.",
      startTimestamp: new Date("2026-03-15T09:00:00"),
      duration: "2 hours",
      coverImageUrl: null,
      visibility: EventVisibility.Public,
    },
    {
      id: "event_002",
      organizationId: orgId,
      name: "Event 2",
      location: "GT Admissions Center",
      description: "Event description 2.",
      startTimestamp: new Date("2026-03-22T10:00:00"),
      duration: "3 hours",
      coverImageUrl: "https://placehold.co/600x400/orange/white",
      visibility: EventVisibility.Public,
    },
    {
      id: "event_003",
      organizationId: orgId,
      name: "Event 3",
      location: "Bits of Good",
      description: "Event description 3.",
      startTimestamp: new Date("2026-04-05T13:00:00"),
      duration: "4 hours",
      coverImageUrl: "https://placehold.co/600x400/blue/white",
      publishedAt: new Date("2025-12-18T14:00:00"),
      visibility: EventVisibility.Public,
    },
    {
      id: "event_004",
      organizationId: orgId,
      name: "Event 4",
      location: "BOG",
      description: "Event description 4.",
      startTimestamp: new Date("2026-01-10T11:00:00"),
      duration: "3 hours",
      coverImageUrl: null,
      visibility: EventVisibility.Public,
      publishedAt: new Date("2025-12-18T14:00:00"),
    },
    {
      id: "event_005",
      organizationId: orgId,
      name: "Event 5",
      location: "Student Center",
      description: "Event description 5.",
      startTimestamp: new Date("2025-12-18T14:00:00"),
      duration: "2 hours",
      coverImageUrl: null,
      visibility: EventVisibility.Public,
      publishedAt: new Date("2025-12-18T14:00:00"),
    },
  ];

  await db.insert(schema.events).values(eventsData).onConflictDoNothing();

  log("Events created.");

  const tagsData = [
    { tagId: "tag_volunteer", organizationId: orgId, tag: "Volunteer" },
    { tagId: "tag_workshop", organizationId: orgId, tag: "Workshop" },
    { tagId: "tag_social", organizationId: orgId, tag: "Social" },
    { tagId: "tag_fundraiser", organizationId: orgId, tag: "Fundraiser" },
  ];

  await db.insert(schema.tags).values(tagsData).onConflictDoNothing();

  const eventTagsData = [
    { eventId: "event_001", tagId: "tag_volunteer" },
    { eventId: "event_001", tagId: "tag_workshop" },
    { eventId: "event_002", tagId: "tag_social" },
    { eventId: "event_003", tagId: "tag_workshop" },
    { eventId: "event_003", tagId: "tag_fundraiser" },
    { eventId: "event_004", tagId: "tag_volunteer" },
  ];

  await db.insert(schema.eventTags).values(eventTagsData).onConflictDoNothing();

  log("Tags created.");
  const usersToRsvp = [
    "admin@example.com",
    "member1@example.com",
    "member2@example.com",
  ];

  for (const email of usersToRsvp) {
    const userId = userIdsByEmail.get(email)!;

    await db
      .insert(schema.eventRsvps)
      .values(eventsData.map((e) => ({ userId, eventId: e.id })))
      .onConflictDoNothing();
  }

  log("RSVPs created.");

  const notificationTemplates: Array<{
    type: NotificationType;
    text: string;
    read: boolean;
    minutesAgo: number;
  }> = [
    {
      type: NotificationType.ActionRequired,
      text: "You have a pending RSVP for Event 1. Please confirm your attendance.",
      read: false,
      minutesAgo: 8,
    },
    {
      type: NotificationType.Announcement,
      text: "Welcome to the spring semester! Check out our new schedule and upcoming events.",
      read: false,
      minutesAgo: 120,
    },
    {
      type: NotificationType.Confirmation,
      text: "Your RSVP for Event 2 has been confirmed. See you there!",
      read: true,
      minutesAgo: 1380,
    },
    {
      type: NotificationType.Confirmation,
      text: "Your profile update has been saved successfully.",
      read: true,
      minutesAgo: 1440,
    },
    {
      type: NotificationType.Reminder,
      text: "Event 3 is tomorrow at Bits of Good. Don't forget to attend!",
      read: false,
      minutesAgo: 10080,
    },
    {
      type: NotificationType.Members,
      text: "A new member has joined the organization. Say hello!",
      read: true,
      minutesAgo: 20160,
    },
    {
      type: NotificationType.ScheduleUpdate,
      text: "Event 4 has been rescheduled to a new time. Please check the updated schedule.",
      read: false,
      minutesAgo: 43200,
    },
    {
      type: NotificationType.General,
      text: "Weekly digest: You have 3 upcoming events this month.",
      read: true,
      minutesAgo: 4320,
    },
    {
      type: NotificationType.ActionRequired,
      text: "Please complete your profile by adding a phone number.",
      read: true,
      minutesAgo: 60,
    },
    {
      type: NotificationType.Announcement,
      text: "Volunteer signups for the campus cleanup are now open. Sign up before spots fill!",
      read: false,
      minutesAgo: 360,
    },
    {
      type: NotificationType.Reminder,
      text: "Don't forget: team meeting this Friday at 3 PM.",
      read: true,
      minutesAgo: 2880,
    },
    {
      type: NotificationType.ScheduleUpdate,
      text: "The location for Event 5 has changed to the Student Center Room 201.",
      read: false,
      minutesAgo: 7200,
    },
    {
      type: NotificationType.Members,
      text: "Member Two updated their role preferences. Review the changes.",
      read: true,
      minutesAgo: 15000,
    },
    {
      type: NotificationType.General,
      text: "Reminder: organization dues are due by the end of the month.",
      read: false,
      minutesAgo: 30,
    },
  ];

  const memberEmails = [
    "owner@example.com",
    "admin@example.com",
    "member1@example.com",
    "member2@example.com",
  ];

  for (const email of memberEmails) {
    for (const org of ORGS) {
      const notificationValues = notificationTemplates.map((tmpl) => ({
        id: randomUUID(),
        userId: userIdsByOrganization.get(org.id)!.get(email)!,
        organizationId: org.id,
        type: tmpl.type,
        text: tmpl.text,
        read: tmpl.read,
        createdAt: new Date(Date.now() - tmpl.minutesAgo * 60 * 1000),
      }));

      await db
        .insert(schema.notifications)
        .values(notificationValues)
        .onConflictDoNothing();
    }
  }

  log("Notifications created.");
  log("Seeding completed successfully.");
}

// Only run the seed script if this file is executed directly, not when imported in tests
if (!isTest) {
  main()
    .then(() => process.exit(0)) // Exit here instead of in main so we can call it in tests
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}
