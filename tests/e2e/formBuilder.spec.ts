import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { DEFAULT_FORM_SETTINGS } from "@/lib/forms/constants";
import {
  FormStatus,
  OrganizationConfigKey,
  formAnswers,
  formSubmissions,
} from "@/lib/schema";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { FormService } from "@/lib/services/FormService";
import {
  createTestAdminAndSignIn,
  createTestMemberAndSignIn,
} from "./testUtils";
import { createForm } from "../unit/testUtils";

// The palette's names, in the order the admin adds them.
const TYPES = [
  "Section header",
  "Short text",
  "Long text",
  "Email",
  "Phone",
  "Number",
  "Single choice",
  "Checkboxes",
  "Dropdown",
  "Date",
  "Yes/No",
  "Image upload",
];

const labelFor = (type: string) => `${type} question`;

/** The tenant's origin, e.g. http://acme.lvh.me:3000. */
function tenantUrl(slug: string, baseURL: string | undefined) {
  const url = new URL(baseURL ?? "http://localhost:3000");
  url.hostname = `${slug}.lvh.me`;
  return url.origin;
}

test("an admin builds a form with every question type and a member submits it", async ({
  page,
  browser,
  browserName,
  baseURL,
}) => {
  const { org } = await createTestAdminAndSignIn(page);
  await OrganizationConfigService.setConfig(
    org.id,
    OrganizationConfigKey.FormsEnabled,
    "true",
  );
  const form = await createForm(org.id, {
    formId: "builder-e2e",
    title: "Builder E2E",
    components: [],
  });

  // Open it from the forms list, so Back has somewhere to go.
  await page.goto("/settings/forms");
  await page
    .getByRole("row")
    .filter({ hasText: form.formId })
    .getByRole("link", { name: "Edit questions" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Edit questions" }),
  ).toBeVisible();
  await expect(page.getByText("No questions yet")).toBeVisible();

  // Add one question of each type and label it.
  for (const type of TYPES) {
    await page
      .getByRole("button", { name: `Add ${type}`, exact: true })
      .click();
    const label = page
      .getByLabel(type === "Section header" ? "Title" : "Question", {
        exact: true,
      })
      .last();
    await expect(label).toBeFocused();
    await label.fill(labelFor(type));
  }
  // Settings for a couple of types.
  const date = page.getByRole("region", { name: /Date: Date question/ });
  await date.getByLabel("Earliest date").fill("2027-06-01");
  const dropdown = page.getByRole("region", {
    name: /Dropdown: Dropdown question/,
  });
  await dropdown.getByLabel("Option 2", { exact: true }).fill("Second choice");
  await page
    .getByRole("region", { name: /Yes\/No: Yes\/No question/ })
    .getByLabel("Required")
    .check();

  // A blank label blocks the save and focuses the field.
  const shortText = page.getByRole("region", { name: /^2\. Short text:/ });
  await shortText.getByLabel("Question", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save questions" }).click();
  await expect(shortText.getByText("Add a label")).toBeVisible();
  await expect(shortText.getByLabel("Question", { exact: true })).toBeFocused();
  await shortText
    .getByLabel("Question", { exact: true })
    .fill(labelFor("Short text"));

  // Move the email question above long text, then save and reload.
  await page.getByRole("button", { name: "Move question 4 up" }).click();
  await page.getByRole("button", { name: "Save questions" }).click();
  await expect(
    page.getByText("Changes were saved successfully!"),
  ).toBeVisible();
  await page.reload();

  const expected = [...TYPES];
  [expected[2], expected[3]] = [expected[3], expected[2]];
  const list = page.getByRole("region", { name: "Questions", exact: true });
  await expect(list.locator("h3")).toHaveText(
    expected.map((type, index) => `${index + 1}. ${type}`),
  );
  await expect(
    list.getByRole("heading", { name: `3. Email: ${labelFor("Email")}` }),
  ).toBeVisible();
  for (const [index, type] of expected.entries())
    await expect(
      list
        .getByLabel(type === "Section header" ? "Title" : "Question", {
          exact: true,
        })
        .nth(type === "Section header" ? 0 : index - 1),
    ).toHaveValue(labelFor(type));
  await expect(date.getByLabel("Earliest date")).toHaveValue("2027-06-01");
  await expect(dropdown.getByLabel("Option 2", { exact: true })).toHaveValue(
    "Second choice",
  );

  // Unsaved changes ask before leaving through a link or the back button.
  await shortText.getByLabel("Required").check();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Back to forms" }).click();
  await expect(page).toHaveURL(new RegExp(`/settings/forms/${form.formId}$`));
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/settings/forms/${form.formId}$`));
  await expect(shortText.getByLabel("Required")).toBeChecked();
  // Once nothing is unsaved, the guard drops its extra history entry...
  const guardEntryRemoved = page.evaluate(
    () =>
      new Promise((resolve) =>
        window.addEventListener("popstate", resolve, { once: true }),
      ),
  );
  await page.getByRole("button", { name: "Discard changes" }).click();
  await guardEntryRemoved;
  // ...so Back leaves in one step and doesn't ask. (Skipped in Firefox, where
  // Back after the reload above stays on this page even without the guard.)
  if (browserName !== "firefox") {
    await page.goBack();
    await expect(page).toHaveURL(/\/settings\/forms$/);
    await page.goForward();
    await expect(
      page.getByRole("heading", { name: "Edit questions" }),
    ).toBeVisible();
  }

  // Publish from the forms list; the builder is then read-only.
  await page.getByRole("link", { name: "Back to forms" }).click();
  const row = page.getByRole("row").filter({ hasText: form.formId });
  await row.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(row).toContainText("published");
  expect((await FormService.get(org.id, form.formId)).status).toBe(
    FormStatus.Published,
  );
  await page.goto(`/settings/forms/${form.formId}`);
  await expect(page.getByRole("note")).toContainText(
    "Questions lock once a form is published",
  );
  await expect(
    page.getByRole("button", { name: "Save questions" }),
  ).toHaveCount(0);

  // A member fills it out on the org's site.
  const origin = tenantUrl(org.slug, baseURL);
  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();
  await createTestMemberAndSignIn(member, {
    organizationId: org.id,
    baseUrl: origin,
  });
  await member.goto(`${origin}/forms/${form.formId}`);
  await expect(
    member.getByRole("heading", { name: labelFor("Section header") }),
  ).toBeVisible();

  // Yes/no is required.
  await member.getByRole("button", { name: "Submit" }).click();
  await expect(member.getByText("This question is required")).toBeVisible();
  await expect(member.getByRole("button", { name: "Yes" })).toBeFocused();

  await member.getByLabel(labelFor("Short text")).fill("Ada Lovelace");
  await member.getByLabel(labelFor("Email")).fill("ada@example.com");
  await member.getByLabel(labelFor("Long text")).fill("Loves math.");
  await member.getByLabel(labelFor("Phone")).fill("(404) 555-0123");
  await member.getByLabel(labelFor("Number")).fill("12");
  await member
    .getByRole("radiogroup")
    .getByLabel("Option 2", { exact: true })
    .check();
  const checkboxes = member.getByRole("group", {
    name: labelFor("Checkboxes"),
  });
  await checkboxes.getByLabel("Option 1", { exact: true }).check();
  await checkboxes.getByLabel("Option 2", { exact: true }).check();
  await member.getByLabel(labelFor("Dropdown")).click();
  await member.getByRole("menuitem", { name: "Second choice" }).click();
  await member.getByLabel(labelFor("Date")).fill("2027-06-15");
  await member.getByRole("button", { name: "Yes" }).click();
  await member.getByRole("button", { name: "Submit" }).click();

  await expect(
    member.getByText(DEFAULT_FORM_SETTINGS.confirmationMessage),
  ).toBeVisible();
  const [submission] = await db
    .select()
    .from(formSubmissions)
    .where(eq(formSubmissions.formId, form.id));
  const answers = await db
    .select()
    .from(formAnswers)
    .where(eq(formAnswers.submissionId, submission.id));
  expect(answers.map(({ value }) => value)).toEqual(
    expect.arrayContaining([
      "Ada Lovelace",
      "ada@example.com",
      "Loves math.",
      "4045550123",
      12,
      "Option 2",
      ["Option 1", "Option 2"],
      "Second choice",
      "2027-06-15",
      true,
    ]),
  );
  await memberContext.close();
});
