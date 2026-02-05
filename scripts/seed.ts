import "dotenv/config"; //must be first to load environment variables
import { schema } from "../lib/schema";
import db from "../lib/db";

async function main() {
  console.log("Seeding database...");

  const orgId = "org_servicestart";
  await db
    .insert(schema.organizations)
    .values({
      id: orgId,
      name: "ServiceStart",
      slug: "servicestart",
    })
    .onConflictDoNothing();

  console.log("Organization created or already exists.");

  const usersData = [
    {
      id: "user_owner",
      name: "Owner User",
      email: "owner@example.com",
      role: "owner",
    },
    {
      id: "user_admin",
      name: "Admin User",
      email: "admin@example.com",
      role: "admin",
    },
    {
      id: "user_member1",
      name: "Member One",
      email: "member1@example.com",
      role: "member",
    },
    {
      id: "user_member2",
      name: "Member Two",
      email: "member2@example.com",
      role: "member",
    },
    {
      id: "user_non_member",
      name: "Non Member",
      email: "nonmember@example.com",
      role: null,
    },
  ];

  for (const userData of usersData) {
    await db
      .insert(schema.users)
      .values({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        emailVerified: true,
      })
      .onConflictDoNothing();

    if (userData.role) {
      await db
        .insert(schema.members)
        .values({
          id: `member_${userData.id}`,
          userId: userData.id,
          organizationId: orgId,
          role: userData.role,
        })
        .onConflictDoNothing();
    }
  }

  console.log("Users and members created.");
  console.log("Seeding completed successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
