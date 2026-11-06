import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  FormStatus,
  MemberType,
  OrganizationConfigKey,
  SubmissionReviewStatus,
} from "@/core/db/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import { VISIONARIES_APPLICATION_FORM } from "@/tests/unit/fixtures/forms";
import { DEFAULT_APPLICATION_STATUS_STEPS } from "@/features/dashboard/lib/schema";
import {
  addMember,
  buildTestUser,
  createForm,
  createFormSubmission,
  setActiveOrganization,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";
import { createTestAdminAndSignIn } from "./testUtils";

for (const width of [1280, 768]) {
  test(`an admin accepts an applicant and their dashboard changes at ${width}px`, async ({
    page,
    browser,
    baseURL,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const { org } = await createTestAdminAndSignIn(page);
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.FormsEnabled,
      "true",
    );
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.MemberTypesEnabled,
      "true",
    );
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.ApplicantDashboardLayout,
      JSON.stringify({
        layout: "horizontal",
        widgets: [
          {
            id: "application_status",
            size: "tall",
            config: {
              formId: VISIONARIES_APPLICATION_FORM.formId,
              steps: DEFAULT_APPLICATION_STATUS_STEPS,
            },
          },
        ],
      }),
    );
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.AttendeeDashboardLayout,
      JSON.stringify({
        layout: "horizontal",
        widgets: [
          { id: "forms_todo", size: "small" },
          { id: "forms_completed", size: "tall" },
        ],
      }),
    );
    const form = await createForm(org.id, {
      formId: VISIONARIES_APPLICATION_FORM.formId,
      title: VISIONARIES_APPLICATION_FORM.title,
      status: FormStatus.Published,
      settings: {
        ...VISIONARIES_APPLICATION_FORM.settings,
        acceptedMemberType: MemberType.Attendee,
      },
    });
    const applicant = await signUpAndGetSession(
      {
        ...buildTestUser(),
        email: "applicant-pending@example.com",
        name: "Pending Applicant",
      },
      org.slug,
    );
    await addMember(applicant.user.id, org.id, "member", MemberType.Applicant);
    await setActiveOrganization(applicant.session.id, org.id);
    const submissionId = await createFormSubmission(form, {
      userId: applicant.user.id,
    });
    await createFormSubmission(form, {
      reviewStatus: SubmissionReviewStatus.Accepted,
    });
    const studentContext = await browser.newContext({ baseURL });
    try {
      const [name, ...value] =
        applicant.headers.Cookie.split(";")[0].split("=");
      await studentContext.addCookies([
        {
          name,
          value: value.join("="),
          domain: new URL(baseURL ?? "http://localhost:3000").hostname,
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const studentPage = await studentContext.newPage();
      await studentPage.goto("/");
      await expect(
        studentPage.locator('[data-widget-id="application_status"]'),
      ).toBeVisible();

      await page.goto("/settings/forms");
      await expect(
        page.getByRole("button", { name: "Create Form", exact: true }),
      ).toBeEnabled();
      await page
        .getByRole("row")
        .filter({ hasText: form.title })
        .getByRole("link", { name: "Responses", exact: true })
        .click();
      await page
        .getByLabel("Review status", { exact: true })
        .selectOption(SubmissionReviewStatus.Pending);
      const row = page
        .getByRole("row")
        .filter({ hasText: applicant.user.email });
      await expect(row).toContainText("Pending");
      await expect(
        row.getByRole("link", { name: "View response" }),
      ).toHaveAttribute(
        "href",
        `/settings/forms/${form.formId}/responses/${submissionId}`,
      );
      await row.getByRole("checkbox").check();
      await page
        .getByLabel("Change selected to")
        .selectOption(SubmissionReviewStatus.Accepted);
      await page
        .getByRole("button", { name: "Change status", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText(
        "1 students will be notified; 1 members will have their member type changed",
      );
      await dialog
        .getByRole("button", { name: "Confirm status change" })
        .click();
      await expect(dialog).not.toBeVisible();
      await expect(row).not.toBeVisible();
      await page
        .getByLabel("Review status", { exact: true })
        .selectOption(SubmissionReviewStatus.Accepted);
      await expect(row).toContainText("Accepted");

      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export CSV" }).click();
      const download = await downloadPromise;
      const csv = await readFile((await download.path())!, "utf8");
      expect(csv).toContain('"Review status"');
      expect(csv).toContain('"Accepted"');

      await studentPage.reload();
      await expect(
        studentPage.locator('[data-widget-id="forms_todo"]'),
      ).toBeVisible();
      await expect(
        studentPage.locator('[data-widget-id="application_status"]'),
      ).toHaveCount(0);
      await studentPage.goto("/inbox");
      await studentPage
        .getByRole("link")
        .filter({
          hasText: `Your response to “${form.title}” has been accepted.`,
        })
        .first()
        .click();
      await expect(
        studentPage.getByRole("link", { name: "View dashboard" }),
      ).toHaveAttribute("href", "/");
    } finally {
      await studentContext.close();
    }
  });
}

test("response selection stays on the visible page and a failed change can be retried", async ({
  page,
}) => {
  const { org } = await createTestAdminAndSignIn(page);
  await OrganizationConfigService.setConfig(
    org.id,
    OrganizationConfigKey.FormsEnabled,
    "true",
  );
  const form = await createForm(org.id);
  for (let index = 0; index < 26; index++) await createFormSubmission(form);
  await page.goto(`/settings/forms/${form.formId}/responses`);
  const selectAll = page.getByLabel("Select all on this page");
  await expect(selectAll).toBeEnabled();
  await selectAll.focus();
  await selectAll.press("Space");
  await expect(page.getByText("25 selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("0 selected", { exact: true })).toBeVisible();
  await expect(page.getByText("Page 2 of 2", { exact: false })).toBeVisible();
  await page.getByLabel("Select all on this page").check();
  await page.route(
    "**/api/formResponses/status",
    async (route) =>
      route.fulfill({
        status: 500,
        json: { error: "Temporary review failure" },
      }),
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Change status", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("0 students will be notified");
  await dialog.getByRole("button", { name: "Confirm status change" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Temporary review failure",
  );
  await dialog.getByRole("button", { name: "Confirm status change" }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByLabel("Review status", { exact: true })
    .selectOption(SubmissionReviewStatus.UnderReview);
  await expect(page.getByText("Page 1 of 1", { exact: false })).toBeVisible();
  await page.getByLabel("Select all on this page").check();
  await page.getByLabel("Search name or email").fill("no-match@example.com");
  await expect(page.getByText("0 selected", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No matching responses" }),
  ).toBeVisible();
});
