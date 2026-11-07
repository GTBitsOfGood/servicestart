import { expect, test, type Page } from "@playwright/test";
import type { FormDefinition } from "@/features/forms/lib/schema";
import {
  MemberType,
  OrganizationConfigKey,
  SubmissionReviewStatus,
} from "@/core/db/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import {
  VISIONARIES_APPLICATION_FORM,
  VISIONARIES_ATTENDEE_FORMS,
  buildSampleAnswers,
} from "../unit/fixtures/forms";
import {
  addMember,
  buildTestUser,
  createForm,
  createFormSubmission,
  createFormUpload,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
} from "../unit/testUtils";

const [EMERGENCY_CONTACT_FORM, CONSENT_FORM, MEDICAL_HISTORY_FORM] =
  VISIONARIES_ATTENDEE_FORMS;

/** The tenant's origin, e.g. http://acme.lvh.me:3000. */
function tenantUrl(slug: string, baseURL: string | undefined) {
  const url = new URL(baseURL ?? "http://localhost:3000");
  url.hostname = `${slug}.${process.env.E2E_TENANT_DOMAIN || "lvh.me"}`;
  return url.origin;
}

/** An organization with forms and member types on, like Visionaries. */
async function createFormsOrg() {
  const org = await createOrganization(
    `form-review-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
  );
  for (const key of [
    OrganizationConfigKey.FormsEnabled,
    OrganizationConfigKey.MemberTypesEnabled,
  ]) {
    await OrganizationConfigService.setConfig(org.id, key, "true");
  }
  return org;
}

/** Copies a Visionaries fixture form into the organization. */
function copyForm(organizationId: string, form: FormDefinition) {
  return createForm(organizationId, {
    formId: form.formId,
    title: form.title,
    status: form.status,
    settings: form.settings,
    components: form.components,
  });
}

/** Signs up a user who belongs to the organization, with it active. */
async function createUser(
  organizationId: string,
  role: string,
  memberType: MemberType | null = null,
) {
  const { user, session, headers } = await signUpAndGetSession(buildTestUser());
  await addMember(user.id, organizationId, role, memberType);
  await setActiveOrganization(session.id, organizationId);
  return { user, cookie: headers.Cookie };
}

/** Signs the browser in with a session cookie from `createUser`. */
async function signIn(page: Page, origin: string, cookie: string) {
  const [name, ...value] = cookie.split(";")[0].split("=");
  // A page load can call set-active, whose response sets the session cookie.
  // Leave the previous user's page first so a response still in flight can't
  // land after the swap and sign that user back in.
  await page.goto("about:blank");
  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name,
      value: value.join("="),
      domain: new URL(origin).hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/**
 * A camper who has submitted their emergency contacts and consent form but not
 * their medical history, and an applicant whose application is under review.
 */
async function setup() {
  const org = await createFormsOrg();
  const [emergencyContact, consent, application] = await Promise.all([
    copyForm(org.id, EMERGENCY_CONTACT_FORM),
    copyForm(org.id, CONSENT_FORM),
    copyForm(org.id, VISIONARIES_APPLICATION_FORM),
    copyForm(org.id, MEDICAL_HISTORY_FORM),
  ]);

  const admin = await createUser(org.id, "admin");
  const camper = await createUser(org.id, "member", MemberType.Attendee);
  const emergencyContactSubmission = await createFormSubmission(
    emergencyContact,
    { userId: camper.user.id, answers: buildSampleAnswers(emergencyContact) },
  );
  await createFormSubmission(consent, {
    userId: camper.user.id,
    answers: buildSampleAnswers(consent),
  });

  const applicant = await createUser(org.id, "member", MemberType.Applicant);
  const uploadId = await createFormUpload(application, {
    uploadedBy: applicant.user.id,
  });
  const applicationSubmission = await createFormSubmission(application, {
    userId: applicant.user.id,
    answers: buildSampleAnswers(application, { uploadId }),
    reviewStatus: SubmissionReviewStatus.UnderReview,
  });

  return {
    org,
    admin,
    camper,
    emergencyContactSubmission,
    applicationSubmission,
  };
}

test.describe("admin submission page", () => {
  test("an attendee adds a second emergency contact and an admin reads both", async ({
    page,
    baseURL,
  }) => {
    const org = await createFormsOrg();
    const source = structuredClone(EMERGENCY_CONTACT_FORM);
    for (const component of source.components)
      if (component.type === "question_group") component.config.minEntries = 1;
    const form = await copyForm(org.id, source);
    const camper = await createUser(org.id, "member", MemberType.Attendee);
    const admin = await createUser(org.id, "admin");
    const origin = tenantUrl(org.slug, baseURL);
    await signIn(page, origin, camper.cookie);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/forms/${form.formId}`);
    await page.getByLabel(/^Contact Name/).fill("Taylor Camper");
    await page.getByLabel(/^Relationship to Camper/).fill("Parent");
    await page.getByLabel(/^Contact Phone Number/).fill("4045550123");
    await page.getByRole("button", { name: "Add another contact" }).click();
    await page
      .getByLabel(/^Contact Name/)
      .nth(1)
      .fill("Jordan Camper");
    await page
      .getByLabel(/^Relationship to Camper/)
      .nth(1)
      .fill("Guardian");
    await page
      .getByLabel(/^Contact Phone Number/)
      .nth(1)
      .fill("4045550456");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await test.info().attach("mobile-emergency-contacts", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Response submitted" }),
    ).toBeVisible();
    await signIn(page, origin, admin.cookie);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(`${origin}/settings/forms/${form.formId}/responses`);
    await page
      .getByRole("link", { name: /view response/i })
      .first()
      .click();
    await expect(page.getByLabel(/^Contact Name/).nth(0)).toHaveValue(
      "Taylor Camper",
    );
    await expect(page.getByLabel(/^Contact Name/).nth(1)).toHaveValue(
      "Jordan Camper",
    );
    await expect(page.getByLabel(/^Contact Phone Number/).nth(1)).toHaveValue(
      "4045550456",
    );
    const phoneInput = await page
      .getByLabel(/^Contact Phone Number/)
      .first()
      .boundingBox();
    expect(phoneInput?.width).toBeGreaterThan(150);
    await expect(
      page.getByRole("button", { name: "Add another contact" }),
    ).toHaveCount(0);
    await test.info().attach("admin-emergency-contacts", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });

  test("an admin reviews a submission and asks for a missing form", async ({
    page,
    baseURL,
  }) => {
    const {
      org,
      admin,
      camper,
      emergencyContactSubmission,
      applicationSubmission,
    } = await setup();
    const origin = tenantUrl(org.slug, baseURL);
    await signIn(page, origin, admin.cookie);

    await page.goto(
      `${origin}/settings/forms/${EMERGENCY_CONTACT_FORM.formId}/responses/${emergencyContactSubmission}`,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: camper.user.name }),
    ).toBeVisible();
    const first = page.getByRole("region", {
      name: "Emergency Contact",
      exact: true,
    });
    await expect(
      first
        .getByRole("group", { name: "Emergency contacts 1", exact: true })
        .getByLabel(/^Contact Name/),
    ).toBeVisible();
    await expect(
      first
        .getByRole("group", { name: "Emergency contacts 2", exact: true })
        .getByLabel(/^Contact Name/),
    ).toBeVisible();

    const required = page.getByRole("region", {
      name: "Other required forms",
    });
    await expect(
      required.getByRole("listitem").filter({ hasText: "Consent Form" }),
    ).toContainText("Completed");
    const medical = required
      .getByRole("listitem")
      .filter({ hasText: "Medical History" });
    await expect(medical).toContainText("Not Submitted");
    await medical
      .getByRole("button", { name: "Request Information for Medical History" })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Message (optional)")
      .fill("Please send this before camp.");
    await dialog.getByRole("button", { name: "Send" }).click();
    await expect(dialog.getByRole("status")).toContainText("Request sent");
    await dialog.getByRole("button", { name: "Done" }).click();

    await page.goto(
      `${origin}/settings/forms/${VISIONARIES_APPLICATION_FORM.formId}/responses/${applicationSubmission}`,
    );
    const status = page.getByRole("group", { name: "Application status" });
    await status.getByRole("button", { name: "Under Review" }).click();
    await page.getByRole("menuitem", { name: "Accepted" }).click();
    await expect(status.getByRole("status")).toHaveText("");
    await expect(status.getByRole("alert")).toHaveCount(0);
    await page.reload();
    await expect(
      page
        .getByRole("group", { name: "Application status" })
        .getByRole("button", { name: "Accepted" }),
    ).toBeVisible();

    await signIn(page, origin, camper.cookie);
    await page.goto(`${origin}/inbox`);
    await expect(
      page.getByText("Please complete Medical History").first(),
    ).toBeVisible();
  });

  test("another organization's admin can't open the submission", async ({
    page,
    baseURL,
  }) => {
    const { emergencyContactSubmission } = await setup();
    const other = await createFormsOrg();
    const otherAdmin = await createUser(other.id, "admin");
    const origin = tenantUrl(other.slug, baseURL);
    await signIn(page, origin, otherAdmin.cookie);

    const response = await page.goto(
      `${origin}/settings/forms/${EMERGENCY_CONTACT_FORM.formId}/responses/${emergencyContactSubmission}`,
    );

    expect(response?.status()).toBe(404);
  });
});
