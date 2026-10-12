import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import {
  FormStatus,
  OrganizationConfigKey,
  formAnswers,
  formSubmissions,
} from "@/lib/schema";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { createTestMemberAndSignIn } from "./testUtils";
import {
  VISIONARIES_APPLICATION_FORM,
  createForm,
  createOrganization,
} from "../unit/testUtils";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** The tenant's origin, e.g. http://acme.lvh.me:3000. */
function tenantUrl(slug: string, baseURL: string | undefined) {
  const url = new URL(baseURL ?? "http://localhost:3000");
  url.hostname = `${slug}.lvh.me`;
  return url.origin;
}

async function createFormsOrg() {
  const slug = `forms-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const org = await createOrganization(slug);
  await OrganizationConfigService.setConfig(
    org.id,
    OrganizationConfigKey.FormsEnabled,
    "true",
  );
  return org;
}

async function fillOutApplication(page: Page) {
  const fill = (label: RegExp, value: string) =>
    page.getByLabel(label).fill(value);
  await fill(/^Student Name/, "Ada Lovelace");
  await fill(/^Student Number/, "00123");
  await fill(/^Student Email/, "ada@example.com");
  await fill(/^Parent Name/, "Anne Byron");
  await fill(/^Parent Phone Number/, "(404) 555-0123");
  await fill(/^Parent Email/, "anne@example.com");
  await fill(/^What grade/, "9");
  await fill(/^Does the camper/, "N/A");
  await fill(/^Why would you like/, Array(120).fill("camp").join(" "));
  await page.locator('input[type="file"]').setInputFiles({
    name: "headshot.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(
    page.getByRole("button", { name: "Replace image" }),
  ).toBeVisible();
}

test.describe("Form fill-out page", () => {
  test("an applicant fills out and submits the Visionaries application", async ({
    page,
    baseURL,
  }) => {
    const org = await createFormsOrg();
    const origin = tenantUrl(org.slug, baseURL);
    const form = await createForm(org.id, {
      title: VISIONARIES_APPLICATION_FORM.title,
      status: FormStatus.Published,
      settings: VISIONARIES_APPLICATION_FORM.settings,
    });
    await createTestMemberAndSignIn(page, {
      organizationId: org.id,
      baseUrl: origin,
    });

    await page.goto(`${origin}/forms/${form.formId}`);
    await expect(
      page.getByRole("heading", { name: VISIONARIES_APPLICATION_FORM.title }),
    ).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);

    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByLabel(/^Student Name/)).toBeFocused();

    await fillOutApplication(page);
    await page.getByRole("button", { name: "Submit" }).click();

    await expect(
      page.getByText(form.settings.confirmationMessage),
    ).toBeVisible();
    const [submission] = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.formId, form.id));
    const answers = await db
      .select()
      .from(formAnswers)
      .where(eq(formAnswers.submissionId, submission.id));
    const headshot = form.components.at(-1)!;
    expect(answers.find((a) => a.componentId === headshot.id)?.value).toEqual({
      uploadId: expect.any(String),
    });

    await page.reload();
    await expect(page.getByText("You've already responded")).toBeVisible();
  });

  test("sends a logged-out visitor to login and back", async ({
    page,
    baseURL,
  }) => {
    const org = await createFormsOrg();
    const origin = tenantUrl(org.slug, baseURL);
    const form = await createForm(org.id, { status: FormStatus.Published });

    await page.context().clearCookies();
    await page.goto(`${origin}/forms/${form.formId}`);

    await expect(page).toHaveURL(
      `${origin}/login?redirect=${encodeURIComponent(`/forms/${form.formId}`)}`,
    );
  });

  test("a closed form shows the closed state", async ({ page, baseURL }) => {
    const org = await createFormsOrg();
    const origin = tenantUrl(org.slug, baseURL);
    const form = await createForm(org.id, { status: FormStatus.Closed });
    await createTestMemberAndSignIn(page, {
      organizationId: org.id,
      baseUrl: origin,
    });

    await page.goto(`${origin}/forms/${form.formId}`);

    await expect(page.getByText("This form is closed")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit" })).toHaveCount(0);
  });

  test("org A's form ID returns 404 on org B's subdomain", async ({
    page,
    baseURL,
  }) => {
    const orgA = await createFormsOrg();
    const orgB = await createFormsOrg();
    const form = await createForm(orgA.id, {
      status: FormStatus.Published,
      settings: { requireLogin: false },
    });

    const response = await page.goto(
      `${tenantUrl(orgB.slug, baseURL)}/forms/${form.formId}`,
    );

    expect(response?.status()).toBe(404);
    await expect(page.getByText("Form not found")).toBeVisible();
  });
});
