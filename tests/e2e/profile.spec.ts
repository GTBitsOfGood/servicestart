import { test, expect } from "@playwright/test";
import {
  createTestUserAndSignIn,
  expectPageRedirectsGuestButAllowsPendingJoin,
} from "./testUtils";

test.describe("Profile Page", () => {
  test("requires sign-in but allows users with a pending join request", async ({
    page,
  }) => {
    await expectPageRedirectsGuestButAllowsPendingJoin(page, "/profile");
  });

  test("shows user name and email when signed in", async ({ page }) => {
    const { user } = await createTestUserAndSignIn(page);
    await page.goto("/profile");

    const main = page.getByRole("main");
    await expect(main.getByText(user.name)).toBeVisible();
    await expect(main.getByText(user.email)).toBeVisible();
  });

  test("shows Edit Details button", async ({ page }) => {
    await createTestUserAndSignIn(page);
    await page.goto("/profile");

    await expect(
      page.getByRole("button", { name: /edit details/i }),
    ).toBeVisible();
  });

  test("edit details button opens edit details modal", async ({ page }) => {
    await createTestUserAndSignIn(page);
    await page.goto("/profile");

    await page.getByRole("button", { name: /edit details/i }).click();
    await expect(
      page.getByRole("dialog", { name: /edit details/i }),
    ).toBeVisible();
  });

  test("shows Events and Hours tabs", async ({ page }) => {
    await createTestUserAndSignIn(page);
    await page.goto("/profile");

    await expect(page.getByRole("tab", { name: /events/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /hours/i })).toBeVisible();
  });

  test("shows Upcoming and Past events sections", async ({ page }) => {
    await createTestUserAndSignIn(page);
    await page.goto("/profile");

    await expect(page.getByText(/upcoming events/i)).toBeVisible();
    await expect(page.getByText(/past events/i)).toBeVisible();
  });

  test("switching to Hours tab shows hours content", async ({ page }) => {
    await createTestUserAndSignIn(page);
    await page.goto("/profile");

    await page.getByRole("tab", { name: /hours/i }).click();
    await expect(page.getByText(/total hours/i)).toBeVisible();
  });

  test("switching back to Events tab shows events content", async ({
    page,
  }) => {
    await createTestUserAndSignIn(page);
    await page.goto("/profile");

    await page.getByRole("tab", { name: /hours/i }).click();
    await page.getByRole("tab", { name: /events/i }).click();
    await expect(page.getByText(/upcoming events/i)).toBeVisible();
  });

  test("clicking view details navigates to event page", async ({ page }) => {
    await createTestUserAndSignIn(page);
    await page.goto("/profile");

    const viewDetailsButtons = page.getByRole("button", {
      name: /view details/i,
    });
    const count = await viewDetailsButtons.count();

    if (count > 0) {
      await viewDetailsButtons.first().click();
      await expect(page).toHaveURL(/\/event\/.+/);
    }
  });
});
