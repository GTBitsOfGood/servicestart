import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import type { DashboardLayout } from "@/lib/dashboard/schema";
import {
  FormComponentType,
  FormStatus,
  MemberType,
  OrganizationConfigKey,
  SubmissionReviewStatus,
} from "@/lib/schema";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import {
  addMember,
  buildTestUser,
  createForm,
  createFormSubmission,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
  type TestForm,
} from "../unit/testUtils";

const ATTENDEE_FORMS_LAYOUT: DashboardLayout = {
  layout: "horizontal",
  widgets: [
    { id: "forms_todo", size: "small" },
    { id: "weekly_calendar", size: "small" },
    { id: "forms_completed", size: "tall" },
    { id: "forms_progress", size: "small" },
  ],
};

const ATTENDEE_FORM_TITLES = [
  "Emergency Contact Information",
  "Consent Form",
  "Health Information",
  "Media Release",
] as const;

function tenantUrl(slug: string, baseURL: string | undefined) {
  const url = new URL(baseURL ?? "http://localhost:3000");
  url.hostname = `${slug}.lvh.me`;
  return url.origin;
}

function getCookieParts(cookieHeader: string) {
  const firstPart = cookieHeader.split(";")[0];
  const [name, ...valueParts] = firstPart.split("=");
  return { name, value: valueParts.join("=") };
}

async function createAttendeeWidgetsOrg() {
  const slug = `attendee-widgets-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const org = await createOrganization(slug);
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
    OrganizationConfigKey.AttendeeDashboardLayout,
    JSON.stringify(ATTENDEE_FORMS_LAYOUT),
  );

  const forms: TestForm[] = [];
  for (const title of ATTENDEE_FORM_TITLES) {
    forms.push(
      await createForm(org.id, {
        title,
        formId: `attendee-${randomUUID().slice(0, 8)}`,
        status: FormStatus.Published,
        settings: {
          assignedMemberTypes: [MemberType.Attendee],
          dueAt: "2030-05-01T12:00:00.000Z",
          closesAt: "2030-12-01T12:00:00.000Z",
        },
        components: [
          {
            type: FormComponentType.ShortText,
            label: "Response",
            helpText: null,
            required: true,
            config: {},
          },
        ],
      }),
    );
  }

  return { org, forms };
}

async function createAttendeeMemberAndSignIn(
  page: Page,
  organizationId: string,
  baseUrl: string,
) {
  const user = buildTestUser();
  const { session, headers } = await signUpAndGetSession(user);
  await addMember(
    session.userId,
    organizationId,
    "member",
    MemberType.Attendee,
  );
  await setActiveOrganization(session.id, organizationId);

  const cookieHeader = headers["Cookie"];
  if (!cookieHeader) {
    throw new Error("No auth cookie returned when signing up test user.");
  }

  const { name, value } = getCookieParts(cookieHeader);
  const { hostname } = new URL(baseUrl);

  await page.context().addCookies([
    {
      name,
      value,
      domain: hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  return { user, userId: session.userId };
}

async function expectGauge(page: Page, done: number, total: number) {
  await expect(
    page.getByRole("img", { name: `${done} of ${total} forms completed` }),
  ).toBeVisible();
  await expect(page.getByText(`${done}/${total}`)).toBeVisible();
  await expect(page.getByText("Forms Completed")).toBeVisible();
}

async function openAndSubmitForm(page: Page, title: string) {
  await page.getByRole("link", { name: `Open ${title}` }).click();
  await expect(page).toHaveURL(/\/forms\//);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByRole("textbox", { name: "Response" }).fill("Camp response");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(
    page.getByText("Thanks! Your response has been submitted."),
  ).toBeVisible();
}

test.describe("Attendee forms dashboard widgets", () => {
  test("tracks todo, completed, and gauge as forms are submitted", async ({
    page,
    baseURL,
  }) => {
    const { org, forms } = await createAttendeeWidgetsOrg();
    const origin = tenantUrl(org.slug, baseURL);
    await createAttendeeMemberAndSignIn(page, org.id, origin);

    await page.goto(`${origin}/`);

    await expect(
      page.getByRole("heading", { name: "To-Do List" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Completed Forms" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Forms Progress" }),
    ).toBeVisible();

    await expectGauge(page, 0, 4);
    await expect(page.getByRole("link", { name: /^Open / })).toHaveCount(4);
    for (const title of ATTENDEE_FORM_TITLES) {
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("Not Started")).toHaveCount(4);
    await expect(
      page.getByText("Submitted forms will appear here."),
    ).toBeVisible();

    const firstForm = forms[0]!;
    await openAndSubmitForm(page, firstForm.title);
    await page.goto(`${origin}/`);

    await expectGauge(page, 1, 4);
    await expect(page.getByRole("link", { name: /^Open / })).toHaveCount(3);
    await expect(
      page.getByRole("link", {
        name: `View ${firstForm.title} response`,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: `Edit ${firstForm.title} response`,
      }),
    ).toBeVisible();

    for (const form of forms.slice(1)) {
      await openAndSubmitForm(page, form.title);
      await page.goto(`${origin}/`);
    }

    await expectGauge(page, 4, 4);
    await expect(page.getByRole("link", { name: /^Open / })).toHaveCount(0);
    await expect(page.getByText("You're all caught up!")).toBeVisible();
    await expect(
      page.getByText(
        "Keep an eye on your inbox for updates on your next steps.",
      ),
    ).toBeVisible();
    for (const form of forms) {
      await expect(
        page.getByRole("link", {
          name: `View ${form.title} response`,
        }),
      ).toBeVisible();
    }
  });

  test("lets a member edit a pending response from the dashboard", async ({
    page,
    baseURL,
  }) => {
    const { org, forms } = await createAttendeeWidgetsOrg();
    const origin = tenantUrl(org.slug, baseURL);
    const { userId } = await createAttendeeMemberAndSignIn(
      page,
      org.id,
      origin,
    );
    const form = forms[0]!;
    await createFormSubmission(form, {
      userId,
      answers: { [form.components[0]!.id]: "Original answer" },
    });

    await page.goto(`${origin}/`);
    await page
      .getByRole("link", { name: `Edit ${form.title} response` })
      .click();

    await expect(page).toHaveURL(`${origin}/forms/${form.formId}/edit`);
    const answer = page.getByRole("textbox", { name: "Response" });
    await expect(answer).toHaveValue("Original answer");
    await answer.fill("Updated answer");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toContainText("Changes saved");

    await page.goto(`${origin}/forms/${form.formId}/response`);
    await expect(page.getByRole("textbox", { name: "Response" })).toHaveValue(
      "Updated answer",
    );
  });

  test("hides the edit action once a response is reviewed", async ({
    page,
    baseURL,
  }) => {
    const { org, forms } = await createAttendeeWidgetsOrg();
    const origin = tenantUrl(org.slug, baseURL);
    const { userId } = await createAttendeeMemberAndSignIn(
      page,
      org.id,
      origin,
    );
    const form = forms[0]!;
    await createFormSubmission(form, {
      userId,
      answers: { [form.components[0]!.id]: "Reviewed answer" },
      reviewStatus: SubmissionReviewStatus.Accepted,
    });

    await page.goto(`${origin}/`);

    await expect(
      page.getByRole("link", { name: `View ${form.title} response` }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: `Edit ${form.title} response` }),
    ).toHaveCount(0);
  });
});
