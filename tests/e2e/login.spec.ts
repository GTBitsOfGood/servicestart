import { test, expect } from "@playwright/test";
import {
  createTestUserAndSignIn,
  ensureServicestartOrganization,
  expectPageDoesNotRedirect,
} from "./testUtils";
import { buildTestUser, signUpAndGetSession } from "../unit/testUtils";

test.describe("Login Page", () => {
  // localhost resolves to the `servicestart` tenant; without it the config
  // request 404s and the page correctly renders the not-found state instead.
  test.beforeAll(async () => {
    await ensureServicestartOrganization();
  });

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

  test("login page background uses a linear gradient", async ({ page }) => {
    await page.goto("/login");

    const loginPage = page.getByTestId("page");

    await expect(loginPage).toBeVisible();
    const background = await loginPage.evaluate(
      (e) => getComputedStyle(e).backgroundImage,
    );
    expect(background).toMatch(/linear-gradient\s*\(/i);
  });

  // No e2e coverage for the not-found state: `lib/api.ts` builds the RPC client
  // against getBaseUrl() (NEXT_PUBLIC_BASE_URL), so every tenant's API calls go to
  // one fixed origin. Loading a page on any other host makes that call cross-origin
  // and the browser blocks it before the 404 is readable, so the hook sees a network
  // error rather than "not-found". Covered by the unit tests on useOrganizationConfig
  // until the API client resolves per-tenant origins.
});
