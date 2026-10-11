import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import db from "@/lib/db";
import { invitations, members, users } from "@/lib/schema";
import { AuthMessage } from "@/components/auth/authConstants";
import { InvitationStatus } from "@/lib/services/InvitationService";
import { auth } from "@/lib/auth";
import {
  buildHost,
  buildTestUser,
  createInvitation,
  createOrganization,
  signUpAndGetSession,
} from "../unit/testUtils";

const HOUR_MS = 60 * 60 * 1000;

function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function tenantUrl(slug: string) {
  const base = new URL(process.env.BASE_URL || "http://localhost:3000");
  const domain = process.env.E2E_TENANT_DOMAIN || "lvh.me";
  return `${base.protocol}//${slug}.${domain}${base.port ? `:${base.port}` : ""}`;
}

/** Creates an account in the org on its own host, as signing up there would. */
async function createAccount(
  slug: string,
  user: ReturnType<typeof buildTestUser>,
) {
  await auth.api.signUpEmail({
    body: { ...user, organizationSlug: slug },
    headers: { host: buildHost(slug), "x-organization-slug": slug },
  });
}

async function getRole(organizationId: string, email: string) {
  const [row] = await db
    .select({ role: members.role })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(
      and(eq(members.organizationId, organizationId), eq(users.email, email)),
    );
  return row?.role;
}

/** An org on its own subdomain with a pending invitation for a new email. */
async function setUpInvitation(opts: { role?: string; expiresAt?: Date } = {}) {
  const org = await createOrganization(uniqueSlug("invite"));
  const { user: inviter } = await signUpAndGetSession(buildTestUser());
  const invitee = buildTestUser();
  const invitationId = await createInvitation(org.id, inviter.id, {
    email: invitee.email,
    ...opts,
  });
  return { org, invitee, invitationId };
}

test.describe("Accept invitation", () => {
  test("a new user who accepts an admin invite becomes an admin", async ({
    page,
  }) => {
    const { org, invitee, invitationId } = await setUpInvitation({
      role: "admin",
    });

    await page.goto(`${tenantUrl(org.slug)}/accept-invitation/${invitationId}`);
    await expect(
      page.getByRole("heading", {
        name: `You've been invited to join Organization ${org.slug} as an admin`,
      }),
    ).toBeVisible();
    const email = page.getByLabel("Email");
    await expect(email).toHaveValue(invitee.email);
    await expect(email).toHaveAttribute("readonly", "");

    await page.getByLabel("First Name").fill("New");
    await page.getByLabel("Last Name").fill("Admin");
    await page.getByLabel("Password", { exact: true }).fill(invitee.password);
    await page
      .getByLabel("Confirm Password", { exact: true })
      .fill(invitee.password);
    await page.getByLabel("Confirm Password", { exact: true }).press("Enter");
    await expect(page.getByText(AuthMessage.AccountCreated)).toBeVisible();

    await expect.poll(() => getRole(org.id, invitee.email)).toBe("admin");
    const [invitation] = await db
      .select({ status: invitations.status })
      .from(invitations)
      .where(eq(invitations.id, invitationId));
    expect(invitation.status).toBe(InvitationStatus.Accepted);
  });

  test("an invitee with an account logs in, comes back and accepts", async ({
    page,
  }) => {
    const { org, invitee, invitationId } = await setUpInvitation({
      role: "admin",
    });
    await createAccount(org.slug, invitee);
    const invitePath = `/accept-invitation/${invitationId}`;

    await page.goto(`${tenantUrl(org.slug)}${invitePath}`);
    await page.getByRole("link", { name: "Log in to accept" }).click();
    await page.getByLabel("Email").fill(invitee.email);
    await page.getByLabel("Password", { exact: true }).fill(invitee.password);
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(new RegExp(`${invitePath}$`));
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page).not.toHaveURL(new RegExp(invitePath));
    await expect.poll(() => getRole(org.id, invitee.email)).toBe("admin");
  });

  test("someone signed in with another email is offered to sign out", async ({
    page,
  }) => {
    const { org, invitee, invitationId } = await setUpInvitation();
    const someoneElse = buildTestUser();
    await createAccount(org.slug, someoneElse);
    await page.goto(`${tenantUrl(org.slug)}/login`);
    await page.getByLabel("Email").fill(someoneElse.email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(someoneElse.password);
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto(`${tenantUrl(org.slug)}/accept-invitation/${invitationId}`);
    await expect(
      page.getByText(`This invitation is for ${invitee.email}`),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page.getByLabel("Email")).toHaveValue(invitee.email);
    expect(await getRole(org.id, someoneElse.email)).toBeUndefined();
  });

  test("an expired invite shows the invalid state", async ({ page }) => {
    const { org, invitationId } = await setUpInvitation({
      expiresAt: new Date(Date.now() - HOUR_MS),
    });

    await page.goto(`${tenantUrl(org.slug)}/accept-invitation/${invitationId}`);

    await expect(
      page.getByRole("heading", { name: "This invitation is no longer valid" }),
    ).toBeVisible();
    await expect(page.locator("input")).toHaveCount(0);
  });

  test("org A's invite opened on org B's host is not found", async ({
    page,
  }) => {
    const { invitationId } = await setUpInvitation();
    const otherOrg = await createOrganization(uniqueSlug("other"));

    await page.goto(
      `${tenantUrl(otherOrg.slug)}/accept-invitation/${invitationId}`,
    );

    await expect(page.getByText("invited to join")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  });
});
