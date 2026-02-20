import "dotenv/config"; //must be first to load environment variables
import { schema } from "../lib/schema";
import db from "../lib/db";
import { auth } from "@/lib/auth";
import { DEFAULT_TEST_PASSWORD } from "@/tests/unit/testUtils";

const isTest = require.main !== module; // Check if the script is being run directly or imported in tests

function log(...args: unknown[]) {
  if (!isTest) {
    console.log(...args);
  }
}

export async function main() {
  log("Seeding database...");

  const orgId = "org_servicestart";
  await db
    .insert(schema.organizations)
    .values({
      id: orgId,
      name: "ServiceStart",
      slug: "servicestart",
    })
    .onConflictDoNothing();

  log("Organization created or already exists.");

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
  ];

  for (const userData of usersData) {
    const res = await auth.api
      .signUpEmail({
        body: {
          email: userData.email,
          password: DEFAULT_TEST_PASSWORD,
          name: userData.name,
          phoneNumber: userData.phoneNumber,
        },
      })
      .catch(() =>
        // User already exists, sign in to get the user info
        auth.api.signInEmail({
          body: {
            email: userData.email,
            password: DEFAULT_TEST_PASSWORD,
          },
        }),
      );

    if (userData.role) {
      await db
        .insert(schema.members)
        .values({
          id: `member_${res.user.id}`,
          userId: res.user.id,
          organizationId: orgId,
          role: userData.role,
        })
        .onConflictDoNothing();
    }
  }

  log("Users and members created.");

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
    },
    {
      id: "event_002",
      organizationId: orgId,
      name: "Event 2",
      location: "GT Admissions Center",
      description: "Event description 2.",
      startTimestamp: new Date("2026-03-22T10:00:00"),
      duration: "3 hours",
      coverImageUrl: null,
    },
    {
      id: "event_003",
      organizationId: orgId,
      name: "Event 3",
      location: "Bits of Good",
      description: "Event description 3.",
      startTimestamp: new Date("2026-04-05T13:00:00"),
      duration: "4 hours",
      coverImageUrl: null,
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
    },
  ];

  await db.insert(schema.events).values(eventsData).onConflictDoNothing();

  log("Events created.");
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
