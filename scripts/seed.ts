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
    },
    {
      name: "Admin User",
      email: "admin@example.com",
      role: "admin",
    },
    {
      name: "Member One",
      email: "member1@example.com",
      role: "member",
    },
    {
      name: "Member Two",
      email: "member2@example.com",
      role: "member",
    },
    {
      name: "Non Member",
      email: "nonmember@example.com",
      role: null,
    },
  ];

  for (const userData of usersData) {
    const res = await auth.api
      .signUpEmail({
        body: {
          email: userData.email,
          password: DEFAULT_TEST_PASSWORD,
          name: userData.name,
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
