import { test, expect } from "@playwright/test";
import {
  createTestAdminAndSignIn,
  createTestUserWithPendingJoinRequestAndSignIn,
} from "./testUtils";

test.describe("Home route", () => {
  test("redirects guests from / to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects users with a pending join request to /joinrequeststatus", async ({
    page,
  }) => {
    await createTestUserWithPendingJoinRequestAndSignIn(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/joinrequeststatus/);
    await expect(page.getByTestId("join-request-status-heading")).toBeVisible();
  });

  test("shows the dashboard for signed-in organization members", async ({
    page,
  }) => {
    await createTestAdminAndSignIn(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: /admin dashboard|dashboard/i }),
    ).toBeVisible();
  });
});
