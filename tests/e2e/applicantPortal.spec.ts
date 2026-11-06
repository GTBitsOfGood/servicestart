import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { DashboardLayout } from "@/features/dashboard/lib/schema";
import { DEFAULT_APPLICATION_STATUS_STEPS } from "@/features/dashboard/lib/schema";
import type { NavbarConfig } from "@/features/navigation/navItems";
import {
  FormStatus,
  MemberType,
  OrganizationConfigKey,
  SubmissionReviewStatus,
} from "@/lib/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import {
  addMember,
  buildTestUser,
  createForm,
  createFormSubmission,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
  VISIONARIES_APPLICATION_FORM,
  type TestForm,
} from "../unit/testUtils";

// Each test builds its own org: the CI e2e database is migrated but never
// seeded, and specs run in parallel.

const NAVBAR: NavbarConfig = {
  applicant: { hidden: ["/events"], labels: { "/": "My Application" } },
};

function tenantUrl(slug: string, baseURL: string | undefined) {
  const url = new URL(baseURL ?? "http://localhost:3000");
  url.hostname = `${slug}.lvh.me`;
  return url.origin;
}

async function createApplicantOrg() {
  const slug = `applicant-portal-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const org = await createOrganization(slug);
  const form = await createForm(org.id, {
    formId: `camp-${slug}`,
    title: VISIONARIES_APPLICATION_FORM.title,
    status: FormStatus.Published,
    settings: VISIONARIES_APPLICATION_FORM.settings,
  });
  const layout: DashboardLayout = {
    layout: "horizontal",
    widgets: [
      {
        id: "application_status",
        size: "tall",
        config: {
          formId: form.formId,
          steps: DEFAULT_APPLICATION_STATUS_STEPS,
        },
      },
      { id: "notifications", size: "tall" },
    ],
  };
  for (const [key, value] of [
    [OrganizationConfigKey.FormsEnabled, "true"],
    [OrganizationConfigKey.MemberTypesEnabled, "true"],
    [OrganizationConfigKey.ApplicantDashboardLayout, JSON.stringify(layout)],
    [OrganizationConfigKey.NavbarConfig, JSON.stringify(NAVBAR)],
  ] as const) {
    await OrganizationConfigService.setConfig(org.id, key, value);
  }
  return { org, form };
}

/** Signs a new member of the org into `context` on the org's host. */
async function signIn(
  context: BrowserContext,
  origin: string,
  organizationId: string,
  role: "member" | "admin",
  memberType: MemberType | null = null,
) {
  const { user, session, headers } = await signUpAndGetSession(buildTestUser());
  await addMember(user.id, organizationId, role, memberType);
  await setActiveOrganization(session.id, organizationId);
  const [name, ...value] = headers.Cookie.split(";")[0].split("=");
  await context.addCookies([
    {
      name,
      value: value.join("="),
      domain: new URL(origin).hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return user;
}

async function signInApplicant(
  page: Page,
  origin: string,
  form: TestForm,
  reviewStatus?: SubmissionReviewStatus,
) {
  const user = await signIn(
    page.context(),
    origin,
    form.organizationId,
    "member",
    MemberType.Applicant,
  );
  if (reviewStatus) {
    await createFormSubmission(form, { userId: user.id, reviewStatus });
  }
  await page.goto(`${origin}/`);
}

const widget = (page: Page) =>
  page.locator('[data-widget-id="application_status"]');

test.describe("Applicant portal", () => {
  test("an applicant who hasn't applied can start the application", async ({
    page,
    baseURL,
  }) => {
    const { org, form } = await createApplicantOrg();
    const origin = tenantUrl(org.slug, baseURL);
    await signInApplicant(page, origin, form);

    const start = widget(page).getByRole("link", {
      name: "Start application",
    });
    await expect(start).toHaveAttribute("href", `/forms/${form.formId}`);
    await expect(widget(page).getByText(/^Due /)).toBeVisible();
    await expect(async () => {
      await start.click();
      await expect(page).toHaveURL(new RegExp(`/forms/${form.formId}$`));
    }).toPass({ timeout: 10_000 });
  });

  test("a pending applicant sees Pending with step 1 complete", async ({
    page,
    baseURL,
  }) => {
    const { org, form } = await createApplicantOrg();
    const origin = tenantUrl(org.slug, baseURL);
    await signInApplicant(page, origin, form, SubmissionReviewStatus.Pending);

    await expect(widget(page).locator(".rt-Badge")).toHaveText("Pending");
    await expect(widget(page).getByText("Submitted, complete")).toBeAttached();
    await expect(
      widget(page).getByText("Under Review, not started"),
    ).toBeAttached();
    await expect(
      widget(page).getByRole("link", { name: "View Application" }),
    ).toHaveAttribute("href", `/forms/${form.formId}/response`);
  });

  test("an applicant under review sees step 2 current", async ({
    page,
    baseURL,
  }) => {
    const { org, form } = await createApplicantOrg();
    const origin = tenantUrl(org.slug, baseURL);
    await signInApplicant(
      page,
      origin,
      form,
      SubmissionReviewStatus.UnderReview,
    );

    await expect(widget(page).locator(".rt-Badge")).toHaveText("Under Review");
    await expect(
      widget(page).getByText("Under Review, current"),
    ).toBeAttached();
  });

  test("an applicant's navbar hides Events and renames Home", async ({
    page,
    baseURL,
  }) => {
    const { org, form } = await createApplicantOrg();
    const origin = tenantUrl(org.slug, baseURL);
    await page.setViewportSize({ width: 1280, height: 800 });
    await signInApplicant(page, origin, form);

    await expect(
      page.getByRole("link", { name: "My Application" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Home" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Events" })).toHaveCount(0);

    await page.setViewportSize({ width: 375, height: 800 });
    const drawer = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(async () => {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      await expect(
        drawer.getByRole("link", { name: "My Application" }),
      ).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 10_000 });
    await expect(drawer.getByRole("link", { name: "Events" })).toHaveCount(0);
    await expect(drawer.getByRole("link", { name: "Home" })).toHaveCount(0);
  });

  test("an admin changes the Applicants layout and an applicant sees it", async ({
    page,
    browser,
    baseURL,
  }) => {
    const { org, form } = await createApplicantOrg();
    const origin = tenantUrl(org.slug, baseURL);
    await signIn(page.context(), origin, org.id, "admin");
    await page.goto(`${origin}/settings/dashboard?audience=applicant`);

    await expect(
      page.getByRole("link", { name: "Applicants" }),
    ).toHaveAttribute("aria-current", "page");
    const save = page.getByRole("button", { name: "Save Layout" });
    await expect(async () => {
      if (await save.isDisabled()) {
        await page.getByRole("button", { name: "Newsletter" }).click();
      }
      await expect(save).toBeEnabled({ timeout: 2_000 });
    }).toPass({ timeout: 10_000 });
    await save.click();
    await expect(save).toBeDisabled();

    const applicant = await browser.newContext();
    try {
      const applicantPage = await applicant.newPage();
      await signInApplicant(applicantPage, origin, form);
      await expect(
        applicantPage.locator('[data-widget-id="newsletter"]'),
      ).toBeVisible();

      // Back to the member layout, which has no application status widget.
      await page.getByRole("button", { name: "Use the member layout" }).click();
      await expect(
        page.getByText("Using the member layout. Saving creates a separate"),
      ).toBeVisible();
      await applicantPage.reload();
      await expect(
        applicantPage.locator('[data-widget-id="application_status"]'),
      ).toHaveCount(0);
    } finally {
      await applicant.close();
    }
  });
});
