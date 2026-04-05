import { test, expect } from "@playwright/test";
import {
  createTestUserAndSignIn,
  createTestMemberAndSignIn,
  expectPageRedirectsGuestButAllowsPendingJoin,
} from "./testUtils";

// Minimal valid 1×1 JPEG (base64-encoded)
const MINIMAL_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAAR" +
  "CAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=";

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

test.describe("Profile Picture Upload", () => {
  test("uploads a profile picture and shows it on the profile page", async ({
    page,
  }) => {
    await createTestMemberAndSignIn(page);
    await page.goto("/profile");

    await page.getByRole("button", { name: /edit details/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const dialog = page.getByRole("dialog");
    await dialog.locator('input[name="phone"]').fill("555-123-4567");
    await dialog.locator('input[name="location"]').fill("Atlanta, GA");

    await page.locator('input[type="file"]').setInputFiles({
      name: "profile.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from(MINIMAL_JPEG_BASE64, "base64"),
    });

    await expect(
      page.getByRole("dialog").locator('img[alt="Profile preview"]'),
    ).toBeVisible();

    await page.getByRole("button", { name: /^save$/i }).click();

    // Confirm the save succeeded (not an error redirect)
    await expect(page).toHaveURL(/\/profile\?saved=true/);

    // Navigate fresh so the server-rendered session reflects the updated image
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("main img")).toBeVisible();
  });

  test("removes a profile picture", async ({ page }) => {
    await createTestMemberAndSignIn(page);
    await page.goto("/profile");

    // Upload a photo first
    await page.getByRole("button", { name: /edit details/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator('input[name="phone"]').fill("555-123-4567");
    await dialog.locator('input[name="location"]').fill("Atlanta, GA");
    await page.locator('input[type="file"]').setInputFiles({
      name: "profile.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from(MINIMAL_JPEG_BASE64, "base64"),
    });
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page).toHaveURL(/\/profile\?saved=true/);

    // Navigate fresh to confirm image is there before removing it
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main img")).toBeVisible();

    // Now remove it
    await page.getByRole("button", { name: /edit details/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: /remove photo/i }).click();
    await expect(
      page.getByRole("dialog").locator('img[alt="Profile preview"]'),
    ).not.toBeVisible();

    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page).toHaveURL(/\/profile\?saved=true/);

    await page.goto("/profile");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main img")).not.toBeVisible();
  });
});
