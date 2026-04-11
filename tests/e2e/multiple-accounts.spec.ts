import { test, expect, type Page } from "@playwright/test";
import { and, eq, inArray } from "drizzle-orm";
import db from "@/lib/db";
import { members, organizations, users } from "@/lib/schema";
import { buildTestUser, createOrganization } from "../unit/testUtils";

async function ensureOrganization(slug: string) {
  const [existing] = await db
    .select({ id: organizations.id, slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  if (existing) return existing;

  try {
    return await createOrganization(slug);
  } catch {
    const [again] = await db
      .select({ id: organizations.id, slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (!again) {
      throw new Error(`Failed to ensure organization ${slug}`);
    }
    return again;
  }
}

function buildTenantUrl(subdomain: string) {
  const base = new URL(process.env.BASE_URL || "http://localhost:3000");
  // Use lvh.me for local subdomain logic compatibility
  const domain = process.env.E2E_TENANT_DOMAIN || "lvh.me";
  const port = base.port ? `:${base.port}` : "";
  return `${base.protocol}//${subdomain}.${domain}${port}`;
}

async function signUpOnTenant(
  page: Page,
  baseUrl: string,
  user: { name: string; email: string; password: string },
) {
  await page.goto(`${baseUrl}/signup`);
  await page.getByPlaceholder("John").fill(user.name.substring(0, 8));
  await page.getByPlaceholder("Smith").fill(user.name.substring(9));
  await page.getByPlaceholder("example@email.com").fill(user.email);
  await page.getByPlaceholder("Password").fill(user.password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\//);
}

test.describe("Multitenant signup", () => {
  test("allows same email across org subdomains", async ({ browser }) => {
    const orgA = await ensureOrganization("a");
    const orgB = await ensureOrganization("b");

    const credentials = buildTestUser();
    const sharedUser = {
      ...credentials,
      email: `multi-${Date.now()}@example.com`,
    };

    const tenantA = buildTenantUrl("a");
    const tenantB = buildTenantUrl("b");

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await signUpOnTenant(pageA, tenantA, sharedUser);
    await contextA.close();

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await signUpOnTenant(pageB, tenantB, sharedUser);
    await contextB.close();

    const usersWithEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, sharedUser.email));

    expect(usersWithEmail.length).toBe(2);
    expect(
      new Set(usersWithEmail.map((user: { id: string }) => user.id)).size,
    ).toBe(2);

    const memberships = await db
      .select({ organizationId: members.organizationId, role: members.role })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(
        and(
          eq(users.email, sharedUser.email),
          inArray(members.organizationId, [orgA.id, orgB.id]),
        ),
      );

    expect(memberships.length).toBe(2);
    expect(
      new Set(
        memberships.map((m: { organizationId: string }) => m.organizationId),
      ).size,
    ).toBe(2);
    expect(
      memberships.every((m: { role: string }) => m.role === "member"),
    ).toBe(true);
  });
});
