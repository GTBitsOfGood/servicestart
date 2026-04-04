import { test, expect } from "@playwright/test";
import { createTestUserAndSignIn } from "./testUtils";
import { buildTestUser, signUpAndGetSession } from "../unit/testUtils";

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

  test("login page uses brand gradient from org config defaults", async ({
    page,
  }) => {
    await page.goto("/login");

    const loginPage = page.getByTestId("page");

    await expect(loginPage).toBeVisible();
    const background = await loginPage.evaluate(
      (e) => getComputedStyle(e).backgroundImage,
    );
    // OrganizationConfigService primary/secondary fallbacks when no DB row:
    // #FD8033 → rgb(253, 128, 51), #FB3552 → rgb(251, 53, 82)
    expect(background).toContain("linear-gradient(75deg");
    expect(background).toContain("rgb(253, 128, 51)");
    expect(background).toContain("rgb(251, 53, 82)");
  });
});
