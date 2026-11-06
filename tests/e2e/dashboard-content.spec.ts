import { expect, test, type Page } from "@playwright/test";
import {
  addCalendarDays,
  startOfDashboardWeek,
} from "@/features/events/lib/calendar";
import type { DashboardHeaderConfig } from "@/features/dashboard/lib/header";
import type { DashboardLayout } from "@/features/dashboard/lib/schema";
import type { OrganizationFooter } from "@/features/navigation/footer";
import {
  MemberType,
  NotificationType,
  OrganizationConfigKey,
} from "@/lib/schema";
import { NotificationService } from "@/features/communications/services/NotificationService";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import {
  addMember,
  buildTestUser,
  createEvent,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";
import { ensureServicestartOrganization } from "./testUtils";

function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
}

function port() {
  return (
    new URL(process.env.BASE_URL ?? "http://localhost:3000").port || "3000"
  );
}

function tenantUrl(slug: string) {
  return `http://${slug}.lvh.me:${port()}`;
}

async function addSessionCookie(
  page: Page,
  cookieHeader: string,
  baseUrl: string,
) {
  const [cookie] = cookieHeader.split(";");
  const [name, ...valueParts] = cookie.split("=");
  await page.context().addCookies([
    {
      name,
      value: valueParts.join("="),
      domain: new URL(baseUrl).hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function createOrganizationUser(
  page: Page,
  organization: { id: string; slug: string },
  options: {
    role: "admin" | "member";
    memberType?: MemberType | null;
    name: string;
    baseUrl?: string;
  },
) {
  const credentials = { ...buildTestUser(), name: options.name };
  const { user, session, headers } = await signUpAndGetSession(credentials);
  await addMember(
    user.id,
    organization.id,
    options.role,
    options.memberType ?? null,
  );
  await setActiveOrganization(session.id, organization.id);

  const baseUrl = options.baseUrl ?? tenantUrl(organization.slug);
  await addSessionCookie(page, headers.Cookie, baseUrl);
  return { user, baseUrl };
}

async function configureCampDashboard(organizationId: string) {
  const layout: DashboardLayout = {
    layout: "horizontal",
    widgets: [{ id: "weekly_calendar", size: "tall" }],
  };
  const header: DashboardHeaderConfig = {
    attendee: {
      title: "My Test Camp Dashboard",
      subtitle: "Everything you need for camp.",
      location: "123 Camp Way, Atlanta, GA",
      dates: "June 2 – Aug 20",
      schedule: "Mon & Wed | 10 AM – 5 PM",
      description: "Workshops, mentorship, and community projects.",
    },
  };
  const footer: OrganizationFooter = {
    email: "hello@testcamp.org",
    ein: "84-4516921",
    socialLinks: [
      { platform: "instagram", url: "https://instagram.com/testcamp" },
    ],
  };

  await Promise.all([
    OrganizationConfigService.setConfig(
      organizationId,
      OrganizationConfigKey.MemberTypesEnabled,
      "true",
    ),
    OrganizationConfigService.setConfig(
      organizationId,
      OrganizationConfigKey.NavbarVariant,
      "horizontal-center",
    ),
    OrganizationConfigService.setConfig(
      organizationId,
      OrganizationConfigKey.AttendeeDashboardLayout,
      JSON.stringify(layout),
    ),
    OrganizationConfigService.setConfig(
      organizationId,
      OrganizationConfigKey.DashboardHeader,
      JSON.stringify(header),
    ),
    OrganizationConfigService.setConfig(
      organizationId,
      OrganizationConfigKey.OrganizationFooter,
      JSON.stringify(footer),
    ),
    OrganizationConfigService.setConfig(
      organizationId,
      OrganizationConfigKey.LogoUrl,
      "/organizations/visionaries-logo.png",
    ),
  ]);
}

test.describe("Configurable dashboard content", () => {
  test("an attendee sees its tenant's header, alert, calendar, and footer and can dismiss the alert", async ({
    page,
  }) => {
    const organization = await createOrganization(uniqueSlug("dashboard-camp"));
    const otherOrganization = await createOrganization(
      uniqueSlug("dashboard-other"),
    );
    await configureCampDashboard(organization.id);
    await OrganizationConfigService.setConfig(
      otherOrganization.id,
      OrganizationConfigKey.DashboardHeader,
      JSON.stringify({ attendee: { title: "Other Organization Dashboard" } }),
    );
    await OrganizationConfigService.setConfig(
      otherOrganization.id,
      OrganizationConfigKey.OrganizationFooter,
      JSON.stringify({ email: "secret@other.org" }),
    );

    const { baseUrl } = await createOrganizationUser(page, organization, {
      role: "member",
      memberType: MemberType.Attendee,
      name: "Camp Attendee",
    });

    const eventTime = addCalendarDays(startOfDashboardWeek(new Date()), 2);
    eventTime.setHours(10, 0, 0, 0);
    await createEvent(organization.id, {
      name: "Camp Leadership Workshop",
      startTimestamp: eventTime,
    });
    await createEvent(otherOrganization.id, {
      name: "Secret Other Organization Event",
      startTimestamp: eventTime,
    });
    await NotificationService.notifyAllMembers(
      organization.id,
      "Weather update\nCamp is closed this Friday.",
      { type: NotificationType.Announcement },
    );

    await page.goto(baseUrl);

    await expect(
      page.getByRole("heading", { name: "My Test Camp Dashboard", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Everything you need for camp.")).toBeVisible();
    await expect(page.getByText("123 Camp Way, Atlanta, GA")).toBeVisible();
    await expect(page.getByText(/June 2 – Aug 20.*Mon & Wed/)).toBeVisible();
    await expect(
      page.getByText(
        "Camp Description: Workshops, mentorship, and community projects.",
      ),
    ).toBeVisible();

    const alerts = page.getByRole("region", { name: "Dashboard alerts" });
    await expect(alerts).toContainText("1 New Alert(s)");
    await expect(alerts).toContainText("Camp is closed this Friday.");
    await expect(
      page.getByRole("link", { name: /Camp Leadership Workshop/ }),
    ).toBeVisible();
    await expect(page.getByText("Secret Other Organization Event")).toHaveCount(
      0,
    );

    await expect(
      page.getByRole("link", { name: "hello@testcamp.org" }),
    ).toBeVisible();
    await expect(page.getByText("EIN: 84-4516921")).toBeVisible();
    await expect(page.getByRole("link", { name: "Instagram" })).toHaveAttribute(
      "href",
      "https://instagram.com/testcamp",
    );
    await expect(
      page.getByRole("img", { name: "Organization logo" }).last(),
    ).toBeVisible();
    await expect(page.getByText("Other Organization Dashboard")).toHaveCount(0);
    await expect(page.getByText("secret@other.org")).toHaveCount(0);

    await page.getByRole("button", { name: "Dismiss alerts" }).click();
    await expect(alerts).toBeHidden();
    await page.reload();
    await expect(alerts).toBeHidden();
  });

  test("an admin edits the attendee title and posts an alert that the attendee sees", async ({
    browser,
  }) => {
    const organization = await createOrganization(uniqueSlug("dashboard-edit"));
    await configureCampDashboard(organization.id);

    const adminContext = await browser.newContext();
    const attendeeContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const attendeePage = await attendeeContext.newPage();

    const { baseUrl } = await createOrganizationUser(adminPage, organization, {
      role: "admin",
      name: "Camp Admin",
    });
    await createOrganizationUser(attendeePage, organization, {
      role: "member",
      memberType: MemberType.Attendee,
      name: "Camp Attendee",
    });

    await adminPage.goto(`${baseUrl}/settings/dashboard-content`);
    await adminPage.getByRole("tab", { name: "Current Attendees" }).click();
    await adminPage
      .getByRole("textbox", { name: "Title", exact: true })
      .fill("Updated Attendee Dashboard");
    await expect(
      adminPage.getByText("You have unsaved changes."),
    ).toBeVisible();
    await adminPage
      .getByRole("button", { name: "Save dashboard content" })
      .click();
    await expect(
      adminPage.getByText("Changes were saved successfully!"),
    ).toBeVisible();

    await adminPage.getByLabel("Alert title").fill("Permission slip reminder");
    await adminPage
      .getByLabel("Alert message")
      .fill("Please bring your permission slip tomorrow.");
    await adminPage.getByLabel("Current attendees").check();
    await adminPage.getByRole("button", { name: "Post alert" }).click();
    await expect(
      adminPage.getByText("Alert posted successfully to 1 member."),
    ).toBeVisible();

    await attendeePage.goto(baseUrl);
    await expect(
      attendeePage.getByRole("heading", {
        name: "Updated Attendee Dashboard",
        level: 1,
      }),
    ).toBeVisible();
    await expect(
      attendeePage.getByText("Please bring your permission slip tomorrow."),
    ).toBeVisible();

    await attendeePage.goto(`${baseUrl}/settings/dashboard-content`);
    await expect(attendeePage).toHaveURL((url) => url.pathname === "/");

    await adminContext.close();
    await attendeeContext.close();
  });

  test("the unconfigured ServiceStart dashboard keeps its default content", async ({
    page,
  }) => {
    const organization = await ensureServicestartOrganization();
    const baseUrl = `http://localhost:${port()}`;
    await createOrganizationUser(page, organization, {
      role: "member",
      name: "ServiceStart Member",
      baseUrl,
    });

    await page.goto(baseUrl);

    await expect(
      page.getByRole("heading", { name: "Dashboard", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Dashboard alerts" }),
    ).toHaveCount(0);
    await expect(page.getByText("My Test Camp Dashboard")).toHaveCount(0);
  });
});
