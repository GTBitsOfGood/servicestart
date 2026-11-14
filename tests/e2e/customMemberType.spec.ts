import { expect, test, type Page } from "@playwright/test";
import type { DashboardLayout } from "@/features/dashboard/lib/schema";
import { OrganizationConfigKey } from "@/core/config/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import { MemberTypeKeySchema } from "@/features/membership/lib/memberTypeKey";
import { setMemberTypeDashboardLayout } from "@/features/dashboard/server";
import {
  addMember,
  buildTestUser,
  setActiveOrganization,
  signUpAndGetSession,
} from "../unit/testUtils";
import { createTestAdminAndSignIn } from "./testUtils";

const volunteerKey = MemberTypeKeySchema.parse("volunteer");

async function signInMember(page: Page, organizationId: string, slug: string) {
  const user = buildTestUser();
  const {
    user: signedUp,
    session,
    headers,
  } = await signUpAndGetSession(user, slug);
  await addMember(signedUp.id, organizationId, "member", volunteerKey);
  await setActiveOrganization(session.id, organizationId);
  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
  const port = new URL(baseUrl).port || "3000";
  const origin = `http://${slug}.lvh.me:${port}`;
  const [name, ...value] = headers.Cookie.split(";")[0].split("=");
  await page.context().addCookies([
    {
      name,
      value: value.join("="),
      domain: `${slug}.lvh.me`,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return origin;
}

test("member sees a layout saved for their custom type", async ({ page }) => {
  const { org } = await createTestAdminAndSignIn(page);
  await OrganizationConfigService.setConfig(
    org.id,
    OrganizationConfigKey.MemberTypesEnabled,
    "true",
  );

  await page.goto("/settings/member-types");
  await page.getByRole("button", { name: "Add member type" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Label", { exact: true }).fill("Volunteer");
  await dialog.getByLabel("Plural label", { exact: true }).fill("Volunteers");
  const typeCreated = page.waitForResponse(
    (response) =>
      response.url().includes("/api/memberTypes") &&
      response.request().method() === "POST" &&
      response.ok(),
  );
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await typeCreated;
  await expect(page.getByText("Key: volunteer")).toBeVisible();

  const layout: DashboardLayout = {
    layout: "horizontal",
    widgets: [{ id: "weekly_calendar", size: "small" }],
  };
  await setMemberTypeDashboardLayout(org.id, volunteerKey, layout);

  const origin = await signInMember(page, org.id, org.slug);
  await page.goto(`${origin}/`);
  await expect(
    page.locator('[data-widget-id="weekly_calendar"]'),
  ).toBeVisible();
});
