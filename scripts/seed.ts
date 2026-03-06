import "dotenv/config"; //must be first to load environment variables
import { schema } from "../lib/schema";
import db from "../lib/db";
import { auth } from "@/lib/auth";
import { OrganizationConfigKey } from "@/lib/schema";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { DEFAULT_TEST_PASSWORD } from "@/tests/unit/testUtils";

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
    navbar: { variant: "sunset-vertical-sidebar", color: "red" },
  },
  {
    id: "org_vertical_icon",
    name: "Vertical Icon Org",
    slug: "vertical-icon",
    navbar: { variant: "sunset-vertical-icon", color: "white" },
  },
  {
    id: "org_horizontal_left",
    name: "Horizontal Left Org",
    slug: "horizontal-left",
    navbar: { variant: "sunset-horizontal-left", color: "red" },
  },
  {
    id: "org_horizontal_center",
    name: "Horizontal Center Org",
    slug: "horizontal-center",
    navbar: { variant: "sunset-horizontal-center", color: "white" },
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
      for (const org of ORGS) {
        await db
          .insert(schema.members)
          .values({
            id: `member_${res.user.id}_${org.id}`,
            userId: res.user.id,
            organizationId: org.id,
            role: userData.role,
          })
          .onConflictDoNothing();
      }
    }
  }

  log("Users and members created.");
  log(
    "Navbar configs by org: servicestart (vertical sidebar, red), vertical-icon (vertical icon, white), horizontal-left (horizontal left, red), horizontal-center (horizontal center, white).",
  );
  log(
    "Add ?org=vertical-icon (or horizontal-left, horizontal-center) to the URL to test different navbar configs.",
  );
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
