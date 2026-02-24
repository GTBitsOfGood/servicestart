import { test, expect } from "@playwright/test";
import { buildTestUser } from "../unit/testUtils";

test.describe("Sign Up Page", () => {
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
