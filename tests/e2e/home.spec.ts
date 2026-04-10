import { test, expect } from "@playwright/test";
import {
  createTestAdminAndSignIn,
  createTestUserWithPendingJoinRequestAndSignIn,
  expectPageRedirectsUnlessApprovedMember,
} from "./testUtils";

test.describe("Home route", () => {
  test("redirects guests and pending join requests away from home", async ({
    page,
  }) => {
    await expectPageRedirectsUnlessApprovedMember(page, "/");
  });

  test("pending join request users see status copy on joinrequeststatus", async ({
    page,
  }) => {
    await createTestUserWithPendingJoinRequestAndSignIn(page);
    await page.goto("/");
    await expect(page.getByTestId("join-request-status-heading")).toBeVisible();
  });

  test("shows the dashboard for signed-in organization members", async ({
    page,
  }) => {
    await createTestAdminAndSignIn(page);
    await page.goto("/");
    await expect(page).toHaveURL((url) => new URL(url).pathname === "/");
    await expect(
      page.getByRole("heading", { name: /admin dashboard|dashboard/i }),
    ).toBeVisible();
  });
});
