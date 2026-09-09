import { test, expect } from "@playwright/test";
import {
  createTestUserAndSignIn,
  expectPageDoesNotRedirect,
} from "./testUtils";
import { buildTestUser, signUpAndGetSession } from "../unit/testUtils";
import { DEFAULT_BRANDING } from "@/lib/branding";
import { OrganizationConfigKey } from "@/lib/schema";

function hexToRgb(hex: string): string {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgb(${r}, ${g}, ${b})`;
}

test.describe("Login Page", () => {
  test("login", async ({ page }) => {
    const user = await buildTestUser();
    await signUpAndGetSession(user);

    await page.goto("/login");
    await page.getByPlaceholder("example@email.com").fill(user.email);
    await page.getByPlaceholder("Password").fill(user.password);

    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL(/\//);
  });

  test("redirect to / if already logged in and current active org matches host", async ({
    page,
  }) => {
    await createTestUserAndSignIn(page);
    await page.goto("/login");
    await expect(page).toHaveURL(/\//);
  });

  test("public static assets are not redirected by auth", async ({ page }) => {
    await expectPageDoesNotRedirect(page, "/logo.svg");
  });

  test("login page background uses documented default branding", async ({
    page,
  }) => {
    await page.goto("/login");

    const loginPage = page.getByTestId("page");
    await expect(loginPage).toBeVisible();

    const background = await loginPage.evaluate(
      (e) => getComputedStyle(e).backgroundImage,
    );
    const normalized = background.replace(/\s/g, "");
    const primary = hexToRgb(
      DEFAULT_BRANDING[OrganizationConfigKey.PrimaryColor],
    ).replace(/\s/g, "");
    const secondary = hexToRgb(
      DEFAULT_BRANDING[OrganizationConfigKey.SecondaryColor],
    ).replace(/\s/g, "");

    expect(background).toMatch(/linear-gradient\s*\(/i);
    expect(normalized).toContain(primary);
    expect(normalized).toContain(secondary);
  });
});
