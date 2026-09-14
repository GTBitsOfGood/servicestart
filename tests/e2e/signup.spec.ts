import { test, expect } from "@playwright/test";
import { buildTestUser } from "../unit/testUtils";
import { ensureServicestartOrganization } from "./testUtils";

test.describe("Sign Up Page", () => {
  // localhost resolves to the `servicestart` tenant; without it the config
  // request 404s and the page correctly renders the not-found state instead.
  test.beforeAll(async () => {
    await ensureServicestartOrganization();
  });

  test("sign up", async ({ page }) => {
    const user = buildTestUser();
    await page.goto("/signup");
    await page.getByPlaceholder("John").fill(user.name.substring(0, 8));
    await page.getByPlaceholder("Smith").fill(user.name.substring(9));
    await page.getByPlaceholder("example@email.com").fill(user.email);
    await page.getByPlaceholder("Password").fill(user.password);
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page).toHaveURL(/\//);
  });
});
