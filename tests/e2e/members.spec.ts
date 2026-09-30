import { test, expect } from "@playwright/test";
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
import { OrganizationConfigKey } from "@/lib/schema";

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
    await page.getByRole("button", { name: "Requests", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "Join Requests" });
    await expect(panel).toBeVisible();
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

    await expect(page.getByText("Admin")).toBeVisible();
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
