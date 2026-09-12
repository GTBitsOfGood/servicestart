import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { organizations, users, accounts } from "@/lib/schema";
import { hashPassword } from "better-auth/crypto";
import { main } from "@/scripts/seed";
import { eq, isNull } from "drizzle-orm";
import { expect, it } from "vitest";
import { DEFAULT_TEST_PASSWORD } from "../testUtils";

it("should run the seed script without errors", async () => {
  await expect(main()).resolves.not.toThrow();
});

it("should create an organization with the slug 'servicestart'", async () => {
  await main();

  const org = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "servicestart"))
    .limit(1);

  expect(org.length).toBe(1);
});

it("should not create duplicate organizations on multiple runs", async () => {
  await main();
  await main(); // Run the seed script twice

  const orgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "servicestart"));

  expect(orgs.length).toBe(1); // Only one organization with the slug 'servicestart' should exist
});

it("creates users/accounts such that they can be signed into", async () => {
  await main();

  const res = await auth.api.signInEmail({
    headers: new Headers({ host: "localhost:3000" }),
    body: {
      email: "owner@example.com",
      password: DEFAULT_TEST_PASSWORD,
    },
  });

  expect(res.token).toBeTruthy();
  expect(res.user.email).toBe("owner@example.com");
});

it("creates distinct admin accounts that can sign in to each seeded tenant", async () => {
  await main();
  await main();
  const admins = await db
    .select()
    .from(users)
    .where(eq(users.email, "admin@example.com"));
  expect(admins).toHaveLength(4);
  expect(new Set(admins.map((user) => user.organizationId)).size).toBe(4);
  expect(
    await db.select().from(users).where(isNull(users.organizationId)),
  ).toHaveLength(0);
  for (const org of await db.select().from(organizations)) {
    const res = await auth.api.signInEmail({
      headers: new Headers({ host: `${org.slug}.lvh.me:3000` }),
      body: { email: "admin@example.com", password: DEFAULT_TEST_PASSWORD },
    });
    expect(res.token).toBeTruthy();
    expect(res.user.id).toBe(
      admins.find((user) => user.organizationId === org.id)?.id,
    );
  }
});

it("repairs an old unscoped seed account without replacing its ID or credential", async () => {
  const password = await hashPassword(DEFAULT_TEST_PASSWORD);
  await db.insert(users).values({
    id: "legacy-admin",
    name: "Admin User",
    email: "admin@example.com",
  });
  await db.insert(accounts).values({
    id: "legacy-credential",
    accountId: "legacy-admin",
    userId: "legacy-admin",
    providerId: "credential",
    password,
  });
  await main();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, "legacy-admin"));
  expect(user.organizationId).toBe("org_servicestart");
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, "legacy-credential"));
  expect(account.password).toBe(password);
  const res = await auth.api.signInEmail({
    headers: new Headers({ host: "localhost:3000" }),
    body: { email: "admin@example.com", password: DEFAULT_TEST_PASSWORD },
  });
  expect(res.user.id).toBe("legacy-admin");
});
