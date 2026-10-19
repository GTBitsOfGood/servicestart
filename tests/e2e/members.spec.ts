import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { EmailService } from "@/lib/services/EmailService";
import {
  createTestAdminAndSignIn,
  createTestUserAndSignIn,
  expectPageRedirectsUnlessAdmin,
} from "./testUtils";
import {
  addMember,
  buildTestUser,
  createJoinRequest,
  signUpAndGetSession,
} from "../unit/testUtils";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import {
  invitations,
  members,
  MemberType,
  OrganizationConfigKey,
} from "@/lib/schema";

test.describe("Members Page", () => {
  test("admin-only access: guests, pending join, and non-admins are redirected", async ({
    page,
  }) => {
    await expectPageRedirectsUnlessAdmin(page, "/members");
  });

  test("request actions remain reachable on a short phone viewport with filters", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const { org } = await createTestAdminAndSignIn(page);
    const requester = buildTestUser();
    const { session } = await signUpAndGetSession(requester);
    await createJoinRequest(session.userId, org.id);

    await page.goto("/members");
    const panel = page.getByRole("dialog", { name: "Join Requests" });
    await openWith(
      page.getByRole("button", { name: "Requests", exact: true }),
      panel,
    );
    for (const width of [375, 639, 640, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(panel).toHaveCSS("width", `${width < 640 ? width : 580}px`);
      expect(
        await panel.evaluate((element) => element.scrollWidth),
      ).toBeLessThanOrEqual(width < 640 ? width : 580);
    }
    await page.setViewportSize({ width: 375, height: 667 });
    await panel.getByRole("button", { name: "Type", exact: true }).click();
    await page.getByRole("menuitem", { name: "Pending" }).click();
    await page.keyboard.press("Escape");
    await panel.getByRole("button", { name: "Sort By", exact: true }).click();
    await page.getByRole("menuitem", { name: "Oldest First" }).click();

    // Simulate the reduced space available when a phone keyboard is open.
    await page.setViewportSize({ width: 375, height: 200 });
    const approve = panel.getByRole("button", { name: "Approve", exact: true });
    await approve.scrollIntoViewIfNeeded();
    await expect(approve).toBeInViewport({ ratio: 1 });
    await approve.click();
    await page
      .getByRole("dialog", { name: "Approve Request" })
      .getByRole("button", { name: "Approve", exact: true })
      .click();
    await expect(
      panel.getByText("There are no pending requests at this time."),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Close", exact: true }).click();
    await expect(panel).not.toBeVisible();
  });

  test("redirects when authenticated but not an org member or admin", async ({
    page,
  }) => {
    await createTestUserAndSignIn(page);
    await page.goto("/members");
    await expect(page).not.toHaveURL(/\/members/);
  });

  test("shows Members heading when signed in as admin", async ({ page }) => {
    await createTestAdminAndSignIn(page);
    await page.goto("/members");

    await expect(
      page.getByRole("heading", { name: /member directory/i }),
    ).toBeVisible();
  });

  test("shows column headers: Member, Role, Contact, Hours, Last Active", async ({
    page,
  }) => {
    await createTestAdminAndSignIn(page);
    await page.goto("/members");

    await expect(
      page.getByRole("columnheader", { name: "Member" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Role" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Contact" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Hours" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Last Active" }),
    ).toBeVisible();
  });

  test("shows the signed-in admin in the member table", async ({ page }) => {
    const { user } = await createTestAdminAndSignIn(page);
    await page.goto("/members");

    await expect(page.locator("main").getByText(user.name)).toBeVisible();
    await expect(page.locator("main").getByText(user.email)).toBeVisible();
  });

  test("shows Admin role for admin users", async ({ page }) => {
    await createTestAdminAndSignIn(page);
    await page.goto("/members");

    // Scoped to the table: while streaming, Next keeps a hidden copy of the page.
    await expect(page.getByRole("table").getByText("Admin")).toBeVisible();
  });

  test("shows remove button for other members but not for self", async ({
    page,
  }) => {
    const { user: adminUser, org } = await createTestAdminAndSignIn(page);

    const otherUser = buildTestUser();
    const { session: otherSession } = await signUpAndGetSession(otherUser);
    await addMember(otherSession.userId, org.id, "member");

    await page.goto("/members");

    // Remove buttons are revealed on row hover — hover the other user's row first
    const otherUserRow = page
      .getByRole("row")
      .filter({ hasText: otherUser.name });
    await otherUserRow.hover();

    const removeButton = page.getByRole("button", {
      name: new RegExp(`remove ${otherUser.name}`, "i"),
    });
    await expect(removeButton.first()).toBeVisible();

    // Hover the admin's own row to reveal their remove button, then verify it is disabled
    const selfRow = page.getByRole("row").filter({ hasText: adminUser.name });
    await selfRow.hover();

    const selfRemoveButton = page.getByRole("button", {
      name: new RegExp(`remove ${adminUser.name}`, "i"),
    });
    const selfCount = await selfRemoveButton.count();
    if (selfCount > 0) {
      await expect(selfRemoveButton).toBeDisabled();
    }
  });

  test("shows pagination controls when there are multiple pages of members", async ({
    page,
  }) => {
    const { org } = await createTestAdminAndSignIn(page);

    for (let i = 0; i < 22; i++) {
      const u = buildTestUser();
      const { session } = await signUpAndGetSession(u);
      await addMember(session.userId, org.id, "member");
    }

    await page.goto("/members");

    await expect(page.getByRole("button", { name: "Next page" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Previous page" }),
    ).toBeVisible();
  });

  test("redirects to / when members_page_enabled is false", async ({
    page,
  }) => {
    const { org } = await createTestAdminAndSignIn(page);

    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.MembersPageEnabled,
      "false",
    );

    await page.goto("/members");
    await expect(page).not.toHaveURL(/\/members/);
  });

  test("previous page button is disabled on first page", async ({ page }) => {
    const { org } = await createTestAdminAndSignIn(page);

    for (let i = 0; i < 22; i++) {
      const u = buildTestUser();
      const { session } = await signUpAndGetSession(u);
      await addMember(session.userId, org.id, "member");
    }

    await page.goto("/members");

    await expect(
      page.getByRole("button", { name: "Previous page" }),
    ).toBeDisabled();
  });
});

async function setMemberTypesEnabled(organizationId: string, enabled: boolean) {
  await OrganizationConfigService.setConfig(
    organizationId,
    OrganizationConfigKey.MemberTypesEnabled,
    String(enabled),
  );
}

async function addTypedMember(organizationId: string, memberType: MemberType) {
  const user = buildTestUser();
  const { session } = await signUpAndGetSession(user);
  await db.insert(members).values({
    id: randomUUID(),
    userId: session.userId,
    organizationId,
    role: "member",
    memberType,
  });
  return user;
}

// No email service runs under e2e (CI has no Juno), so the browser's invite
// requests go through auth.api from here with the email stubbed. The server's
// invite checks and database writes still run.
async function sendInvitesWithoutEmail(page: Page) {
  EmailService.sendInvitationEmail = async () => {};
  const cookie = (await page.context().cookies())
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  await page.route("**/api/auth/organization/invite-member", async (route) => {
    try {
      const invitation = await auth.api.createInvitation({
        body: route.request().postDataJSON(),
        headers: new Headers({ cookie }),
      });
      await route.fulfill({ json: invitation });
    } catch (error) {
      const { statusCode = 500, body } = error as {
        statusCode?: number;
        body?: unknown;
      };
      await route.fulfill({ status: statusCode, json: body ?? {} });
    }
  });
}

// A click before hydration does nothing, so retry until the target opens.
async function openWith(
  trigger: ReturnType<Page["getByRole"]>,
  opened: ReturnType<Page["getByRole"]>,
) {
  await expect(async () => {
    await trigger.click();
    await expect(opened).toBeVisible({ timeout: 1000 });
  }).toPass();
}

async function inviteFromModal(
  page: Page,
  invitee: { name: string; email: string },
  role: "Member" | "Admin",
) {
  const dialog = page.getByRole("dialog", { name: "Add Member" });
  await openWith(page.getByRole("button", { name: "Add member" }), dialog);
  await dialog.locator('input[name="name"]').fill(invitee.name);
  await dialog.locator('input[name="email"]').fill(invitee.email);
  await dialog.getByRole("radio", { name: role }).click();
  await dialog.getByRole("button", { name: "Add & Send Invite Email" }).click();
  await expect(dialog).not.toBeVisible();
}

async function pendingInvitations(organizationId: string, email: string) {
  return db
    .select({ role: invitations.role })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        eq(invitations.email, email),
        eq(invitations.status, "pending"),
      ),
    );
}

test.describe("Members Page - member types", () => {
  test("an admin filters to applicants and marks them as current attendees", async ({
    page,
  }) => {
    const { org } = await createTestAdminAndSignIn(page);
    await setMemberTypesEnabled(org.id, true);
    try {
      const rowApplicant = await addTypedMember(org.id, MemberType.Applicant);
      const bulkApplicant = await addTypedMember(org.id, MemberType.Applicant);
      const attendee = await addTypedMember(org.id, MemberType.Attendee);
      const row = (name: string) =>
        page.getByRole("row").filter({ hasText: name });

      await page.goto("/members");
      await expect(
        page.getByRole("columnheader", { name: "Type" }),
      ).toBeVisible();
      await openWith(
        page.getByRole("button", { name: "All types" }),
        page.getByRole("menuitem", { name: "Applicants" }),
      );
      await page.getByRole("menuitem", { name: "Applicants" }).click();
      await expect(page).toHaveURL(/type=applicant/);
      await expect(row(rowApplicant.name)).toBeVisible();
      await expect(row(bulkApplicant.name)).toBeVisible();
      await expect(row(attendee.name)).not.toBeVisible();

      // From the row.
      await page
        .getByLabel(`Type for ${rowApplicant.name}`)
        .selectOption({ label: "Current Attendee" });
      await expect(row(rowApplicant.name)).not.toBeVisible();

      // In bulk.
      await row(bulkApplicant.name).getByRole("checkbox").click();
      await page
        .getByRole("button", { name: "Mark as current attendee" })
        .click();
      await expect(row(bulkApplicant.name)).not.toBeVisible();

      await page.getByRole("button", { name: "Applicants" }).click();
      await page.getByRole("menuitem", { name: "Current Attendees" }).click();
      await expect(page).toHaveURL(/type=attendee/);
      for (const user of [rowApplicant, bulkApplicant, attendee]) {
        await expect(page.getByLabel(`Type for ${user.name}`)).toHaveValue(
          MemberType.Attendee,
        );
      }
    } finally {
      await setMemberTypesEnabled(org.id, false);
    }
  });

  test("hides the Type column and filter when member types are off", async ({
    page,
  }) => {
    const { org } = await createTestAdminAndSignIn(page);
    await addTypedMember(org.id, MemberType.Applicant);

    await page.goto("/members");

    await expect(
      page.getByRole("heading", { name: /member directory/i }),
    ).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Type" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "All types" })).toHaveCount(
      0,
    );
  });
});

test.describe("Members Page - admin invites", () => {
  test("an admin sends an admin invite from Add Member", async ({ page }) => {
    const { org } = await createTestAdminAndSignIn(page);
    await sendInvitesWithoutEmail(page);
    const invitee = buildTestUser();

    await page.goto("/members");
    const dialog = page.getByRole("dialog", { name: "Add Member" });
    await openWith(page.getByRole("button", { name: "Add member" }), dialog);
    await dialog.getByRole("radio", { name: "Admin" }).click();
    await expect(
      dialog.getByRole("button", { name: "Add", exact: true }),
    ).toBeDisabled();
    await expect(
      dialog.getByText("Admins can only be added by invite."),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await inviteFromModal(page, invitee, "Admin");

    expect(await pendingInvitations(org.id, invitee.email)).toEqual([
      { role: "admin" },
    ]);
  });

  test("re-inviting someone as Admin replaces their pending Member invite", async ({
    page,
  }) => {
    const { org } = await createTestAdminAndSignIn(page);
    await sendInvitesWithoutEmail(page);
    const invitee = buildTestUser();

    await page.goto("/members");
    await inviteFromModal(page, invitee, "Member");
    expect(await pendingInvitations(org.id, invitee.email)).toEqual([
      { role: "member" },
    ]);

    await inviteFromModal(page, invitee, "Admin");

    expect(await pendingInvitations(org.id, invitee.email)).toEqual([
      { role: "admin" },
    ]);
  });
});
