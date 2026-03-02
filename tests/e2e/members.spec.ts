import { test, expect } from "@playwright/test";
import { createTestAdminAndSignIn, createTestUserAndSignIn } from "./testUtils";
import {
  addMember,
  buildTestUser,
  signUpAndGetSession,
} from "../unit/testUtils";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { OrganizationConfigKey } from "@/lib/schema";

test.describe("Members Page", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/members");
    await expect(page).toHaveURL(/\/login/);
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

    await expect(page.getByRole("heading", { name: /members/i })).toBeVisible();
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

    await expect(page.getByText(user.name)).toBeVisible();
    await expect(page.getByText(user.email)).toBeVisible();
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

    const removeButtons = page.getByRole("button", {
      name: new RegExp(`remove ${otherUser.name}`, "i"),
    });
    await expect(removeButtons.first()).toBeVisible();

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
