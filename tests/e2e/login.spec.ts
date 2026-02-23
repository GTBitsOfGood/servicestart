import { test, expect } from "@playwright/test";
import { createTestUserAndSignIn } from "./testUtils";
import {
  buildTestUser,
  createOrganization,
  signUpAndGetSession,
  setActiveOrganization,
} from "../unit/testUtils";
import OrganizationConfigService from "@/lib/services/OrganizationConfigService";
import { OrganizationConfigKey } from "@/lib/schema";

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

  test("check colors", async ({ page }) => {
    const testUser = await buildTestUser();
    const { id } = await createOrganization(
      `org-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    );
    const { session } = await signUpAndGetSession(testUser);
    await setActiveOrganization(session.id, id);

    await OrganizationConfigService.setConfig(
      id,
      OrganizationConfigKey.PrimaryColor,
      "#FD8033",
    );

    await OrganizationConfigService.setConfig(
      id,
      OrganizationConfigKey.SecondaryColor,
      "#FB3552",
    );

    await page.goto("/login");

    const loginPage = page.getByTestId("page");

    await expect(loginPage).toBeVisible();
    await expect(loginPage).toHaveCSS("background-image", /linear-gradient/);

    const background = await loginPage.evaluate(
      (e) => getComputedStyle(e).backgroundImage,
    );
    expect(background).toContain("253, 128, 51");
    expect(background).toContain("251, 53, 82");
  });
});
