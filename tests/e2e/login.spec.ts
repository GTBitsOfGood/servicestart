import { test, expect } from "@playwright/test";
import { createTestUserAndSignIn } from "./testUtils";
import {
  buildTestUser,
  createOrganization,
  addMember,
  signUpAndGetSession,
  setActiveOrganization,
} from "../unit/testUtils";

test.describe("Login Page", () => {
  test("login", async ({ page }) => {
    const theUser = await buildTestUser();
    // const { user, session, headers } = await signUpAndGetSession(theUser);

    await page.goto("/login");
    await page.getByPlaceholder("example@email.com").fill(theUser.email);
    await page.getByPlaceholder("Password").fill(theUser.password);

    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL(/\//);
  });

  test("redirect to / if already logged in and current active org matches host", async ({
    page,
  }) => {
    const user = await createTestUserAndSignIn(page);
    await page.goto("/login");
    await expect(page).toHaveURL(/\//);
  });
});
