import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { organizations } from "@/lib/schema";
import { main } from "@/scripts/seed";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { DEFAULT_TEST_PASSWORD } from "../testUtils";

it("should run the seed script without errors", async () => {
  await main();
});

it("should create an organization with the slug 'servicestart'", async () => {
  await main();

  const org = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "servicestart"))
    .limit(1);

  if (org.length === 0) {
    throw new Error("Organization with slug 'servicestart' not found");
  }
});

it("should not create duplicate organizations on multiple runs", async () => {
  await main();
  await main(); // Run the seed script twice

  const orgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "servicestart"));

  if (orgs.length > 1) {
    throw new Error("Duplicate organizations with slug 'servicestart' found");
  }
});

it("creates users/accounts such that they can be signed into", async () => {
  await main();

  const res = await auth.api.signInEmail({
    body: {
      email: "owner@example.com",
      password: DEFAULT_TEST_PASSWORD,
    },
  });

  expect(res.token).toBeTruthy();
  expect(res.user.email).toBe("owner@example.com");
});
