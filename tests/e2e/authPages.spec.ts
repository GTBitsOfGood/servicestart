import { expect, test, type Page } from "@playwright/test";
import { and, eq, like } from "drizzle-orm";
import db from "@/lib/db";
import { verifications } from "@/lib/schema";
import { AuthMessage } from "@/components/auth/authConstants";
import { AuthFieldError } from "@/lib/authValidation";
import { buildTestUser, signUpAndGetSession } from "../unit/testUtils";
import { ensureServicestartOrganization } from "./testUtils";

test.describe("Auth pages", () => {
  // localhost resolves to the `servicestart` tenant.
  test.beforeAll(async () => {
    await ensureServicestartOrganization();
  });

  test.describe.serial("signup", () => {
    test.beforeEach(async ({ page }) => {
      await page.context().clearCookies();
    });

    async function fillPasswordFields(page: Page, password: string) {
      const passwordField = page.getByLabel("Password", { exact: true });
      const confirmField = page.getByLabel("Confirm Password", {
        exact: true,
      });
      await passwordField.fill(password);
      await confirmField.fill(password);
      await expect(passwordField).toHaveValue(password);
      await expect(confirmField).toHaveValue(password);
    }

    test("shows inline errors instead of submitting an invalid form", async ({
      page,
    }) => {
      let signUpRequests = 0;
      page.on("request", (request) => {
        if (request.url().includes("/api/auth/sign-up")) signUpRequests += 1;
      });
      await page.goto("/signup");

      await page.getByLabel("Email").fill("not-an-email");
      await page.getByLabel("Password", { exact: true }).fill("short");
      await page
        .getByLabel("Confirm Password", { exact: true })
        .fill("different");
      await page.getByLabel("Confirm Password", { exact: true }).press("Enter");

      await expect(
        page.getByText(AuthFieldError.FirstNameRequired),
      ).toBeVisible();
      await expect(
        page.getByText(AuthFieldError.LastNameRequired),
      ).toBeVisible();
      await expect(page.getByText(AuthFieldError.EmailInvalid)).toBeVisible();
      await expect(
        page.getByText(AuthFieldError.PasswordTooShort),
      ).toBeVisible();
      await expect(
        page.getByText(AuthFieldError.PasswordsDontMatch),
      ).toBeVisible();
      await expect(page.getByLabel("Email")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(signUpRequests).toBe(0);
    });

    test("offers to log in when the account already exists", async ({
      page,
    }) => {
      const user = buildTestUser();
      await signUpAndGetSession(user, "servicestart");
      await page.goto("/signup");

      await page.getByLabel("First Name").fill("Existing");
      await page.getByLabel("Last Name").fill("User");
      await page.getByLabel("Email").fill(user.email);
      await fillPasswordFields(page, user.password);
      await page.getByRole("button", { name: "Create Account" }).click();

      const message = page.getByTestId("form-message");
      await expect(message).toContainText(AuthMessage.AccountExists);
      await message.getByRole("link", { name: "Log in instead" }).click();
      await expect(page).toHaveURL(/\/login$/);
    });

    test("confirms the new account, then goes home", async ({ page }) => {
      const user = buildTestUser();
      await page.goto("/signup");

      await page.getByLabel("First Name").fill("New");
      await page.getByLabel("Last Name").fill("Volunteer");
      await page.getByLabel("Email").fill(user.email);
      await fillPasswordFields(page, user.password);
      await page.getByRole("button", { name: "Create Account" }).click();

      await expect(page.getByText(AuthMessage.AccountCreated)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Create Account" }),
      ).toBeDisabled();
      await expect(page).not.toHaveURL(/\/signup/);
    });
  });

  test.describe("login", () => {
    test("says when the password is wrong", async ({ page }) => {
      const user = buildTestUser();
      await signUpAndGetSession(user, "servicestart");
      await page.goto("/login");

      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password", { exact: true }).fill("wrong-password");
      await page.getByLabel("Password", { exact: true }).press("Enter");

      await expect(page.getByTestId("form-message")).toContainText(
        AuthMessage.WrongCredentials,
      );
      await expect(page).toHaveURL(/\/login$/);
    });

    test("requires both fields", async ({ page }) => {
      await page.goto("/login");
      await page.getByRole("button", { name: "Login" }).click();

      await expect(page.getByText(AuthFieldError.EmailRequired)).toBeVisible();
      await expect(
        page.getByText(AuthFieldError.PasswordRequired),
      ).toBeVisible();
    });

    test("shows and hides the password", async ({ page }) => {
      await page.goto("/login");
      const password = page.getByLabel("Password", { exact: true });
      await password.fill("secret-value");
      await expect(password).toHaveAttribute("type", "password");

      await page.getByRole("button", { name: "Show Password" }).click();
      await expect(password).toHaveAttribute("type", "text");

      await page.getByRole("button", { name: "Hide Password" }).click();
      await expect(password).toHaveAttribute("type", "password");
    });
  });

  test("forgot password sends a reset email", async ({ page }) => {
    const user = buildTestUser();
    const { user: created } = await signUpAndGetSession(user, "servicestart");
    await page.goto("/forgotpassword");

    await page.getByLabel("Email").fill(user.email);
    const reset = page.waitForResponse((response) =>
      response.url().includes("/api/auth/request-password-reset"),
    );
    await page.getByRole("button", { name: "Send Reset Link" }).click();

    expect((await reset).status()).toBe(200);
    await expect(page.getByText(AuthMessage.ResetEmailSent)).toBeVisible();
    // BetterAuth stores the emailed token before handing it to the sender.
    const tokens = await db
      .select({ id: verifications.id })
      .from(verifications)
      .where(
        and(
          eq(verifications.value, created.id),
          like(verifications.identifier, "reset-password:%"),
        ),
      );
    expect(tokens).toHaveLength(1);
  });
});
