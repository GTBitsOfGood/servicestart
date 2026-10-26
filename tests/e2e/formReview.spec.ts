import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { OrganizationConfigKey, sessions } from "@/lib/schema";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { main as seed } from "@/scripts/seed";
import { visionariesId } from "../unit/fixtures/forms";
import {
  DEFAULT_TEST_PASSWORD,
  setActiveOrganization,
} from "../unit/testUtils";
import { createTestAdminAndSignIn } from "./testUtils";

const VISIONARIES = "org_visionariestothethrone";
// Seeded submissions: persona i's response to form f is visionariesId(0x10 + i, f).
const MEMBER1_EMERGENCY_CONTACT = visionariesId(0x14, 1);
const APPLICANT_REVIEW_APPLICATION = visionariesId(0x12, 0);

function visionariesUrl(baseURL: string | undefined) {
  const url = new URL(baseURL ?? "http://localhost:3000");
  url.hostname = "visionariestothethrone.lvh.me";
  return url.origin;
}

/** Signs in a seeded Visionaries account with Visionaries active. */
async function signInSeeded(page: Page, origin: string, email: string) {
  const { headers, response } = await auth.api.signInEmail({
    headers: new Headers({ host: new URL(origin).host }),
    body: { email, password: DEFAULT_TEST_PASSWORD },
    returnHeaders: true,
  });
  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.token, response.token));
  await setActiveOrganization(session.id, VISIONARIES);

  const [name, ...value] = headers.get("set-cookie")!.split(";")[0].split("=");
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

test.describe("admin submission page", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seed();
  });

  test("an admin reviews a submission and asks for a missing form", async ({
    page,
    baseURL,
  }) => {
    const origin = visionariesUrl(baseURL);
    await signInSeeded(page, origin, "admin@example.com");

    await page.goto(
      `${origin}/settings/forms/emergency-contact-2027/responses/${MEMBER1_EMERGENCY_CONTACT}`,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Member One" }),
    ).toBeVisible();
    const first = page.getByRole("region", {
      name: "Emergency Contact",
      exact: true,
    });
    const second = page.getByRole("region", {
      name: "Second Emergency Contact",
      exact: true,
    });
    await expect(first.getByLabel(/^Contact Name/)).toBeVisible();
    await expect(first.getByLabel(/^Second Contact Name/)).toHaveCount(0);
    await expect(second.getByLabel(/^Second Contact Name/)).toBeVisible();

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
      `${origin}/settings/forms/camp-application-2027/responses/${APPLICANT_REVIEW_APPLICATION}`,
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

    await signInSeeded(page, origin, "member1@example.com");
    await page.goto(`${origin}/inbox`);
    await expect(
      page.getByText("Please complete Medical History").first(),
    ).toBeVisible();
  });

  test("another organization's admin can't open the submission", async ({
    page,
  }) => {
    const { org } = await createTestAdminAndSignIn(page);
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.FormsEnabled,
      "true",
    );

    const response = await page.goto(
      `/settings/forms/emergency-contact-2027/responses/${MEMBER1_EMERGENCY_CONTACT}`,
    );

    expect(response?.status()).toBe(404);
  });
});
