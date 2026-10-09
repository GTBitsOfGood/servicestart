import { expect, test, type Page } from "@playwright/test";
import { OrganizationConfigKey } from "@/lib/schema";
import OrganizationConfigService from "@/lib/services/OrganizationConfigService";
import {
  addMember,
  buildTestUser,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
} from "../unit/testUtils";

async function createThemedAdminSession(page: Page, slug: string) {
  const org = await createOrganization(slug);
  const credentials = buildTestUser();
  const { session, headers } = await signUpAndGetSession(credentials);

  await addMember(session.userId, org.id, "admin");
  await setActiveOrganization(session.id, org.id);

  const cookieHeader = headers.Cookie;
  const [cookie] = cookieHeader.split(";");
  const [name, ...valueParts] = cookie.split("=");

  await page.context().addCookies([
    {
      name,
      value: valueParts.join("="),
      domain: `${slug}.lvh.me`,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await OrganizationConfigService.setConfig(
    org.id,
    OrganizationConfigKey.NavbarVariant,
    "horizontal-center",
  );

  const configuredBaseUrl = new URL(
    process.env.BASE_URL ?? "http://localhost:3000",
  );
  const port = configuredBaseUrl.port || "3000";

  return { org, baseUrl: `http://${slug}.lvh.me:${port}` };
}

async function selectNewsletterAndGetSaveButton(page: Page) {
  const newsletterButton = page.getByRole("button", {
    name: "Newsletter",
    exact: true,
  });
  const saveButton = page.getByRole("button", { name: "Save Layout" });

  // The settings builder is a client component. Retry the interaction if the
  // first click lands while React is still hydrating the server-rendered page.
  await expect(async () => {
    if (!(await saveButton.isEnabled())) {
      await newsletterButton.click();
    }
    await expect(saveButton).toBeEnabled();
  }).toPass({ timeout: 10_000 });

  return saveButton;
}

async function openRequestsAndGetTypeFilter(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/members`);
  await page.getByRole("button", { name: "Requests", exact: true }).click();

  const typeFilter = page.getByRole("button", { name: "Type", exact: true });
  await expect(typeFilter).toBeVisible();
  return typeFilter;
}

async function getDisplayFontFamily(page: Page) {
  return page.locator("body").evaluate((body) => {
    const displayText = document.createElement("span");
    displayText.className = "text-display";
    displayText.textContent = "Display font test";
    displayText.style.position = "absolute";
    displayText.style.visibility = "hidden";
    body.append(displayText);

    const fontFamily = getComputedStyle(displayText).fontFamily;
    displayText.remove();
    return fontFamily;
  });
}

test.describe("Organization theme", () => {
  test("applies a custom theme to navigation, headings, and primary buttons", async ({
    page,
  }) => {
    const slug = `theme-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const { org, baseUrl } = await createThemedAdminSession(page, slug);

    const config = {
      [OrganizationConfigKey.PrimaryColor]: "#5C218C",
      [OrganizationConfigKey.BackgroundColor]: "#FFFEF1",
      [OrganizationConfigKey.TextColor]: "#373444",
      [OrganizationConfigKey.DisplayFont]: "fredoka",
      [OrganizationConfigKey.HeadingFont]: "lexend",
      [OrganizationConfigKey.BodyFont]: "lexend",
      [OrganizationConfigKey.CornerStyle]: "pill",
    } as const;

    await Promise.all(
      Object.entries(config).map(([key, value]) =>
        OrganizationConfigService.setConfig(
          org.id,
          key as OrganizationConfigKey,
          value,
        ),
      ),
    );

    await page.goto(baseUrl);
    await expect.poll(() => getDisplayFontFamily(page)).toMatch(/Fredoka/);
    const homeLink = page.getByRole("link", { name: "Home", exact: true });
    await expect(homeLink.locator("div").last()).toHaveCSS(
      "background-color",
      "rgb(92, 33, 140)",
    );

    await page.goto(`${baseUrl}/media`);
    await expect(page.locator("html")).toHaveAttribute(
      "data-corner-style",
      "pill",
    );
    await expect(page.getByRole("combobox", { name: "Type" })).toHaveCSS(
      "border-radius",
      "32px",
    );

    await page.goto(`${baseUrl}/inbox`);
    await expect(page.getByPlaceholder("Search notifications...")).toHaveCSS(
      "border-radius",
      "32px",
    );

    const pillTypeFilter = await openRequestsAndGetTypeFilter(page, baseUrl);
    await expect(pillTypeFilter).toHaveCSS("border-radius", "32px");

    await page.goto(`${baseUrl}/settings/admindashboard`);
    const heading = page.getByRole("heading", { name: "Customize Dashboard" });
    await expect(heading).toHaveCSS("font-family", /Lexend/);
    await expect(heading).toHaveCSS("font-weight", "600");
    await expect(heading).toHaveCSS("color", "rgb(55, 52, 68)");

    const saveButton = await selectNewsletterAndGetSaveButton(page);
    await expect(saveButton).toHaveCSS("background-color", "rgb(92, 33, 140)");
    await expect(saveButton).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(saveButton).toHaveCSS("border-radius", "32px");

    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.CornerStyle,
      "square",
    );
    const squareTypeFilter = await openRequestsAndGetTypeFilter(page, baseUrl);
    await expect(page.locator("html")).toHaveAttribute(
      "data-corner-style",
      "square",
    );
    await expect(squareTypeFilter).toHaveCSS("border-radius", "0px");
  });

  test("keeps the current defaults when an organization has no theme rows", async ({
    page,
  }) => {
    const slug = `unthemed-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const { baseUrl } = await createThemedAdminSession(page, slug);

    await page.goto(baseUrl);
    await expect.poll(() => getDisplayFontFamily(page)).toMatch(/visby/i);
    const rootTokens = await page.locator("html").evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        primary: styles.getPropertyValue("--color-brand-text").trim(),
        background: styles.getPropertyValue("--color-page-bg").trim(),
        text: styles.getPropertyValue("--color-page-text").trim(),
        radius: styles.getPropertyValue("--radius-control").trim(),
      };
    });

    expect(rootTokens).toEqual({
      primary: "#FC5B43",
      background: "#FFFFFF",
      text: "#22070B",
      radius: "0.25rem",
    });

    await page.goto(`${baseUrl}/media`);
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-corner-style",
      /.+/,
    );
    await expect(page.getByRole("combobox", { name: "Type" })).toHaveCSS(
      "border-radius",
      "7.5px",
    );

    await page.goto(`${baseUrl}/inbox`);
    await expect(page.getByPlaceholder("Search notifications...")).toHaveCSS(
      "border-radius",
      "4px",
    );

    const typeFilter = await openRequestsAndGetTypeFilter(page, baseUrl);
    await expect(typeFilter).toHaveCSS("border-radius", "100px");

    await page.goto(`${baseUrl}/settings/admindashboard`);
    const heading = page.getByRole("heading", { name: "Customize Dashboard" });
    await expect(heading).toHaveCSS("font-family", /visby/i);
    await expect(heading).toHaveCSS("font-weight", "400");

    const saveButton = await selectNewsletterAndGetSaveButton(page);
    await expect(saveButton).toHaveCSS("background-color", "rgb(252, 91, 67)");
    await expect(saveButton).toHaveCSS("border-radius", "2.5px");
  });

  test("keeps fixed white dashboard cards readable with a dark page theme", async ({
    page,
  }) => {
    const slug = `dark-theme-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const { org, baseUrl } = await createThemedAdminSession(page, slug);

    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.BackgroundColor,
      "#111111",
    );
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.TextColor,
      "#FFFFFF",
    );

    await page.goto(baseUrl);

    const pageHeading = page.getByRole("heading", {
      name: "Admin Dashboard",
      level: 1,
    });
    await expect(pageHeading).toHaveCSS("color", "rgb(255, 255, 255)");

    const cardHeading = page.getByRole("heading", {
      name: "Events",
      level: 3,
    });
    await expect(cardHeading).toHaveCSS("color", "rgb(0, 0, 0)");
    await expect(cardHeading.locator("..")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );

    await expect(page.locator("html")).not.toHaveAttribute(
      "data-corner-style",
      /.+/,
    );
    await page.goto(`${baseUrl}/inbox`);
    await expect(page.getByPlaceholder("Search notifications...")).toHaveCSS(
      "border-radius",
      "4px",
    );
  });
});
