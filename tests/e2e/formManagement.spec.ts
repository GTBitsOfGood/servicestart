import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import {
  createTestAdminAndSignIn,
  createTestMemberAndSignIn,
} from "./testUtils";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { FormService } from "@/lib/services/FormService";
import { OrganizationConfigKey } from "@/lib/schema";
import {
  createForm,
  createFormComponents,
  createFormSubmission,
} from "@/tests/unit/testUtils";

for (const width of [1280, 768]) {
  test(`admin manages forms at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const { org } = await createTestAdminAndSignIn(page);
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.FormsEnabled,
      "true",
    );
    await page.goto("/settings/forms");
    await page.waitForLoadState("load");
    await expect(page.getByText("No forms yet")).toBeVisible();
    await page
      .getByRole("button", { name: "Create Form", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Title", { exact: true })
      .fill("Camp Application 2027");
    await expect(dialog.getByLabel("Form ID", { exact: true })).toHaveValue(
      "camp-application-2027",
    );
    await dialog.getByLabel("Form ID", { exact: true }).fill("camp-test");
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    let row = page.getByRole("row").filter({ hasText: "camp-test" });
    await expect(row).toContainText("draft");
    await row.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Forms management" }).getByRole("alert"),
    ).toContainText("Add at least one question");

    const form = await FormService.get(org.id, "camp-test");
    const components = await createFormComponents(form);
    await createFormSubmission(form, {
      answers: { [components[1].id]: "Student" },
    });
    await row.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(row).toContainText("published");

    // Capture clipboard contents without depending on browser permission prompts.
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            document.documentElement.dataset.copiedFormLink = text;
          },
        },
      });
    });
    await row.getByRole("button", { name: "Copy link", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Form link copied.");
    expect(
      await page.locator("html").getAttribute("data-copied-form-link"),
    ).toBe(new URL("/forms/camp-test", page.url()).href);

    const downloadPromise = page.waitForEvent("download");
    await row.getByRole("button", { name: "Export CSV", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("camp-test.csv");
    const csv = await readFile((await download.path())!, "utf8");
    expect(csv).toContain('"Student Name"');
    expect(csv).toContain('"Student"');
    expect(csv).not.toContain("Contact Information");

    await row.getByRole("button", { name: "Close", exact: true }).click();
    await expect(row).toContainText("closed");
    await row.getByRole("button", { name: "Reopen", exact: true }).click();
    await expect(row).toContainText("published");

    // Settings preserve the slug once published and work with the keyboard.
    await row.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(dialog.getByLabel("Form ID", { exact: true })).toBeDisabled();
    await dialog
      .getByLabel("Title", { exact: true })
      .fill("Updated Camp Application");
    await dialog
      .getByLabel("Confirmation message")
      .fill("Thank you for applying!");
    await dialog
      .getByRole("button", { name: "Save settings", exact: true })
      .click();
    row = page.getByRole("row").filter({ hasText: "camp-test" });
    await expect(row).toContainText("Updated Camp Application");
    await row.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(dialog.getByLabel("Confirmation message")).toHaveValue(
      "Thank you for applying!",
    );
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(
      row.getByRole("button", { name: "Settings", exact: true }),
    ).toBeFocused();
  });
}

test("create validates uniqueness, preserves edited IDs, and draft deletion confirms", async ({
  page,
}) => {
  const { org } = await createTestAdminAndSignIn(page);
  await OrganizationConfigService.setConfig(
    org.id,
    OrganizationConfigKey.FormsEnabled,
    "true",
  );
  await createForm(org.id, {
    title: "Existing form",
    formId: "taken",
    components: [],
  });
  await page.goto("/settings/forms");
  await page.waitForLoadState("load");
  await page.getByRole("button", { name: "Create Form", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title", { exact: true }).fill("New form");
  await dialog.getByLabel("Form ID", { exact: true }).fill("UPPER");
  await expect(
    dialog.getByRole("button", { name: "Create", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Form ID", { exact: true }).fill("taken");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("already in use");
  await dialog.getByLabel("Form ID", { exact: true }).fill("new-form");
  await dialog.getByLabel("Title", { exact: true }).fill("Changed title");
  await expect(dialog.getByLabel("Form ID", { exact: true })).toHaveValue(
    "new-form",
  );
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "new-form" });
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Delete form", exact: true })
    .click();
  await expect(row).toHaveCount(0);
});

test("disabled forms and non-admins cannot open the settings page", async ({
  page,
}) => {
  await createTestAdminAndSignIn(page);
  expect((await page.goto("/settings/forms"))?.status()).toBe(404);
  await expect(
    page.getByRole("link", { name: "Forms", exact: true }),
  ).toHaveCount(0);
  await page.context().clearCookies();
  const { organizationId } = await createTestMemberAndSignIn(page);
  await OrganizationConfigService.setConfig(
    organizationId,
    OrganizationConfigKey.FormsEnabled,
    "true",
  );
  await page.goto("/settings/forms");
  await expect(page).toHaveURL("/");
});
