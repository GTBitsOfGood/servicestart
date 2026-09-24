import { expect, test, type Page } from "@playwright/test";
import { OrganizationConfigKey } from "@/lib/schema";

const unauthenticatedPages = [
  "/login",
  "/signup",
  "/forgotpassword",
  "/resetpassword",
  "/resetpassword?token=branding-test-token",
];

// Browser fixtures exercise the public config contract without changing a shared
// tenant. The API tests separately verify the real admin-save/public-read path.
async function configureBranding(
  page: Page,
  logoUrl: string | null,
  tagline = "Our organization welcomes you",
) {
  await page.route("**/api/organizationConfig?*", async (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get("organizationSlug")).toBe("servicestart");
    const keys = url.searchParams.getAll("keys");
    expect(keys).toContain(OrganizationConfigKey.LogoUrl);
    const config: Record<string, string | null> = {
      [OrganizationConfigKey.LogoUrl]: logoUrl,
      [OrganizationConfigKey.Tagline]: tagline,
      [OrganizationConfigKey.PrimaryColor]: "#FD8033",
      [OrganizationConfigKey.SecondaryColor]: "#FB3552",
    };
    await route.fulfill({
      json: Object.fromEntries(keys.map((key) => [key, config[key]])),
    });
  });
}

async function expectLoadedLogo(page: Page, src: string) {
  const logo = page.getByTestId("organization-logo");
  await expect(logo).toHaveAttribute("src", src);
  await expect(logo).toBeVisible();
  await expect
    .poll(() =>
      logo.evaluate(
        (element: HTMLImageElement) =>
          element.complete && element.naturalWidth > 0,
      ),
    )
    .toBe(true);
  await expect(logo).toHaveCSS("object-fit", "contain");
  const placement = await logo.evaluate((element) => {
    const logoBounds = element.getBoundingClientRect();
    const panelBounds =
      element.parentElement!.parentElement!.getBoundingClientRect();
    return {
      width: logoBounds.width,
      height: logoBounds.height,
      leftInset: logoBounds.left - panelBounds.left,
      bottomInset: panelBounds.bottom - logoBounds.bottom,
    };
  });
  expect(placement.width).toBeCloseTo(72, 0);
  expect(placement.height).toBeCloseTo(72, 0);
  expect(placement.leftInset).toBeCloseTo(20, 0);
  expect(placement.bottomInset).toBeCloseTo(20, 0);
  for (const name of ["bits of good", "sunset"]) {
    const wordmark = page.getByRole("img", { name, exact: true });
    if (src === "/logo.svg") {
      await expect(wordmark).toBeVisible();
      await expect
        .poll(() =>
          wordmark.evaluate(
            (element: HTMLImageElement) =>
              element.complete && element.naturalWidth > 0,
          ),
        )
        .toBe(true);
    } else {
      await expect(wordmark).toHaveCount(0);
    }
  }
}

test.describe("Unauthenticated organization branding", () => {
  for (const path of unauthenticatedPages) {
    test(`loads the configured logo while signed out on ${path}`, async ({
      page,
    }) => {
      expect(await page.context().cookies()).toEqual([]);
      await configureBranding(page, " /bog.svg ");
      await page.goto(path);
      await expectLoadedLogo(page, "/bog.svg");
    });

    for (const logoUrl of [null, "", "   "]) {
      test(`loads the fallback for logo ${JSON.stringify(logoUrl)} on ${path}`, async ({
        page,
      }) => {
        await configureBranding(page, logoUrl);
        const configResponse = page.waitForResponse((response) =>
          new URL(response.url()).pathname.endsWith("/organizationConfig"),
        );
        await page.goto(path);
        await configResponse;
        await expectLoadedLogo(page, "/logo.svg");
      });
    }
  }

  for (const path of ["/login", "/signup"]) {
    test(`renders a readable configured tagline on ${path}`, async ({
      page,
    }) => {
      await configureBranding(page, "/bog.svg");
      await page.goto(path);
      const tagline = page.getByTestId("organization-tagline");
      await expect(tagline).toHaveText("Our organization welcomes you");
      await expect(tagline).toBeVisible();
      const colors = await tagline.evaluate((element) => ({
        foreground: getComputedStyle(element).color,
        background: getComputedStyle(element.parentElement!).backgroundColor,
      }));
      expect(colors.background).toBe("rgb(255, 255, 255)");
      const channels = colors.foreground.match(/\d+/g)!.slice(0, 3).map(Number);
      const linear = channels.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });
      const luminance =
        0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
      expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(4.5);
    });

    test(`uses the default tagline for blank configuration on ${path}`, async ({
      page,
    }) => {
      await configureBranding(page, null, "   ");
      const configResponse = page.waitForResponse((response) =>
        new URL(response.url()).pathname.endsWith("/organizationConfig"),
      );
      await page.goto(path);
      await configResponse;
      await expect(page.getByTestId("organization-tagline")).toHaveText(
        "Welcome",
      );
    });
  }
});
