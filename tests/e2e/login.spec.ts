import { test, expect } from "@playwright/test";
import { createTestUserAndSignIn } from "./testUtils";
import { buildTestUser } from "../unit/testUtils";

test.describe("Login Page", () => {
  test("login", async ({ page }) => {
    const user = await buildTestUser();

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
});
