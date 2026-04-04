import { test, expect } from "@playwright/test";
import {
  createTestAdminAndSignIn,
  createTestUserAndSignIn,
  expectPageRedirectsUnlessAdmin,
} from "./testUtils";
import {
  addMember,
  buildTestUser,
  createEvent,
  createEventRSVP,
  createShift,
  createShiftRSVP,
  signUpAndGetSession,
} from "../unit/testUtils";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { OrganizationConfigKey } from "@/lib/schema";

test.describe("Members Page", () => {
  test("admin-only access: guests, pending join, and non-admins are redirected", async ({
    page,
  }) => {
    await expectPageRedirectsUnlessAdmin(page, "/members");
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

  test("shows Admin role for admin users and Member role for non-admins", async ({
    page,
  }) => {
    const { user: adminUser, org } = await createTestAdminAndSignIn(page);

    const memberUser = buildTestUser();
    const { session: memberSession } = await signUpAndGetSession(memberUser);
    await addMember(memberSession.userId, org.id, "member");

    await page.goto("/members");

    const adminRow = page.getByRole("row").filter({ hasText: adminUser.name });
    await expect(adminRow.getByText("Admin")).toBeVisible();

    const memberRow = page
      .getByRole("row")
      .filter({ hasText: memberUser.name });
    await expect(memberRow.getByText("Member")).toBeVisible();
    await expect(memberRow.getByText("Admin")).not.toBeVisible();
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

  test("pagination buttons navigate between pages", async ({ page }) => {
    const { org } = await createTestAdminAndSignIn(page);

    for (let i = 0; i < 22; i++) {
      const u = buildTestUser();
      const { session } = await signUpAndGetSession(u);
      await addMember(session.userId, org.id, "member");
    }

    await page.goto("/members");

    // Page 1 assertions
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    await expect(page.getByText(/Showing 1–20 of 23 members/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Previous page" }),
    ).toBeDisabled();

    // Navigate to page 2
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
    await expect(page.getByText(/Showing 21–23 of 23 members/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Next page" }),
    ).toBeDisabled();

    // Navigate back to page 1
    await page.getByRole("button", { name: "Previous page" }).click();
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Previous page" }),
    ).toBeDisabled();
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

  test("displays correct hours and last active for members with activity", async ({
    page,
  }) => {
    const { org } = await createTestAdminAndSignIn(page);

    const memberUser = buildTestUser();
    const { session: memberSession } = await signUpAndGetSession(memberUser);
    await addMember(memberSession.userId, org.id, "member");

    // Past event: 7 days ago, duration 3600 seconds = 1 hour
    const pastEventDate = new Date();
    pastEventDate.setDate(pastEventDate.getDate() - 7);
    const eventId = await createEvent(org.id, {
      startTimestamp: pastEventDate,
      duration: "3600",
    });
    await createEventRSVP(eventId, memberSession.userId);

    // Past shift: 3 days ago, duration 1800 seconds = 0.5 hours
    const pastShiftDate = new Date();
    pastShiftDate.setDate(pastShiftDate.getDate() - 3);
    const shiftId = await createShift(org.id, {
      startTimestamp: pastShiftDate,
      duration: 1800,
      eventId,
    });
    await createShiftRSVP(shiftId, memberSession.userId);

    // Navigate and wait for the activity API response
    const activityResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/members/activity") && resp.status() === 200,
    );
    await page.goto("/members");
    await activityResponse;

    const memberRow = page
      .getByRole("row")
      .filter({ hasText: memberUser.name });

    // Expected: 1 + 0.5 = 1.5 hours
    await expect(memberRow.getByText("1.5hrs")).toBeVisible();

    // Expected last active: the shift date (most recent), formatted as MM/DD/YYYY
    const expectedDate = `${String(pastShiftDate.getMonth() + 1).padStart(2, "0")}/${String(pastShiftDate.getDate()).padStart(2, "0")}/${pastShiftDate.getFullYear()}`;
    await expect(memberRow.getByText(expectedDate)).toBeVisible();
  });

  test("remove button removes a member from the table", async ({ page }) => {
    const { org } = await createTestAdminAndSignIn(page);

    const otherUser = buildTestUser();
    const { session: otherSession } = await signUpAndGetSession(otherUser);
    await addMember(otherSession.userId, org.id, "member");

    await page.goto("/members");

    // Verify the other user is visible
    await expect(page.locator("main").getByText(otherUser.name)).toBeVisible();

    // Hover to reveal action buttons and click remove
    const otherUserRow = page
      .getByRole("row")
      .filter({ hasText: otherUser.name });
    await otherUserRow.hover();

    await page
      .getByRole("button", {
        name: new RegExp(`remove ${otherUser.name}`, "i"),
      })
      .first()
      .click();

    // Confirm deletion in the modal
    await expect(page.getByText("Please Confirm Deletion")).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();

    // Verify the member is removed from the table
    await expect(
      page.locator("main").getByText(otherUser.name),
    ).not.toBeVisible();
  });

  test("email button opens the email modal", async ({ page }) => {
    const { org } = await createTestAdminAndSignIn(page);

    const otherUser = buildTestUser();
    const { session: otherSession } = await signUpAndGetSession(otherUser);
    await addMember(otherSession.userId, org.id, "member");

    await page.goto("/members");

    // Hover to reveal action buttons and click email
    const otherUserRow = page
      .getByRole("row")
      .filter({ hasText: otherUser.name });
    await otherUserRow.hover();

    await page
      .getByRole("button", {
        name: new RegExp(`email ${otherUser.name}`, "i"),
      })
      .first()
      .click();

    // Verify the Send Email modal is open
    await expect(
      page.getByRole("heading", { name: "Send Email" }),
    ).toBeVisible();
  });
});
