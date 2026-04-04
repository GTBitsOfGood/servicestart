import { test, expect } from "@playwright/test";
import {
  createTestAdminAndSignIn,
  createTestMemberAndSignIn,
  createTestUserAndSignIn,
  createTestUserWithPendingJoinRequestAndSignIn,
} from "./testUtils";
import { createMedia } from "../unit/testUtils";

test.describe("Media Page", () => {
  test("redirects guests to login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/media");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects signed-in users without an active organization", async ({
    page,
  }) => {
    await createTestUserAndSignIn(page);
    await page.goto("/media");
    await expect(page).not.toHaveURL(/\/media/);
  });

  test("redirects users with a pending join request", async ({ page }) => {
    await createTestUserWithPendingJoinRequestAndSignIn(page);
    await page.goto("/media");
    await expect(page).not.toHaveURL(/\/media/);
  });

  test("redirects organization members who are not admins", async ({
    page,
  }) => {
    await createTestMemberAndSignIn(page);
    await page.goto("/media");
    await expect(page).toHaveURL((url) => new URL(url).pathname === "/");
  });

  test("shows Media Gallery heading and filters for admins", async ({
    page,
  }) => {
    await createTestAdminAndSignIn(page);
    await page.goto("/media");

    await expect(
      page.getByRole("heading", { name: /media gallery/i }),
    ).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Type" })).toBeVisible();
    await expect(page.getByText("Sort by")).toBeVisible();
  });

  test("shows empty-state upload when the organization has no media", async ({
    page,
  }) => {
    await createTestAdminAndSignIn(page);
    await page.goto("/media");

    await expect(page.getByText("Let's get started!")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /choose a file to upload/i }),
    ).toBeVisible();
  });

  test("shows media titles in the grid when the organization has items", async ({
    page,
  }) => {
    const { org } = await createTestAdminAndSignIn(page);
    await createMedia(org.id, { title: "E2E Media Card Title" });

    await page.goto("/media");

    await expect(page.getByText("E2E Media Card Title")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /choose a file to upload/i }),
    ).toBeVisible();
  });
});
