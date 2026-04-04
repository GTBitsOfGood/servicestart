import { test, expect } from "@playwright/test";
import {
  createTestAdminAndSignIn,
  createTestMemberAndSignIn,
  createTestUserAndSignIn,
  createTestUserWithPendingJoinRequestAndSignIn,
} from "./testUtils";
import { createMedia } from "../unit/testUtils";

/** 1×1 PNG for upload E2E (valid raster image). */
const MINIMAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

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

  test.describe("uploads", () => {
    test("uploads an image from the empty state and shows it in the gallery", async ({
      page,
    }) => {
      await createTestAdminAndSignIn(page);
      await page.goto("/media");

      await page.locator('input[type="file"]').setInputFiles({
        name: "e2e-empty-state.png",
        mimeType: "image/png",
        buffer: MINIMAL_PNG,
      });

      await expect(page.getByText("Let's get started!")).toBeHidden({
        timeout: 30_000,
      });
      await expect(page.getByText("e2e-empty-state")).toBeVisible();
    });

    test("uploads an image from the grid when the gallery already has items", async ({
      page,
    }) => {
      const { org } = await createTestAdminAndSignIn(page);
      await createMedia(org.id, { title: "Existing Item" });

      await page.goto("/media");
      await expect(page.getByText("Existing Item")).toBeVisible();

      await page.locator('input[type="file"]').setInputFiles({
        name: "e2e-grid-upload.png",
        mimeType: "image/png",
        buffer: MINIMAL_PNG,
      });

      await expect(page.getByText("e2e-grid-upload")).toBeVisible({
        timeout: 30_000,
      });
    });

    test("shows a client-side error when the file is larger than 10 MB", async ({
      page,
    }) => {
      await createTestAdminAndSignIn(page);
      await page.goto("/media");

      await page.locator('input[type="file"]').setInputFiles({
        name: "huge.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(MAX_IMAGE_BYTES + 1),
      });

      await expect(
        page.getByText("Image must be 10 MB or smaller"),
      ).toBeVisible();
    });

    test("shows an error when the file is not a supported image type", async ({
      page,
    }) => {
      await createTestAdminAndSignIn(page);
      await page.goto("/media");

      await page.locator('input[type="file"]').setInputFiles({
        name: "notes.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("not an image"),
      });

      await expect(
        page.getByText("Only raster image uploads are supported right now"),
      ).toBeVisible({ timeout: 30_000 });
    });
  });
});
