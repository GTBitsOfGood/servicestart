import { expect, test } from "@playwright/test";

// Missing tenants must work before hydration, including under next dev.
for (const slug of ["missing-auth-a", "missing-auth-b"]) {
  for (const path of [
    "/login",
    "/signup",
    "/forgotpassword",
    "/resetpassword?token=test-token",
  ]) {
    test(`shows missing organization at ${slug}${path}`, async ({
      page,
      baseURL,
    }) => {
      const url = new URL(baseURL ?? "http://localhost:3000");
      url.hostname = `${slug}.lvh.me`;
      await page.route("**/_next/static/**", (route) => route.abort());
      const response = await page.goto(new URL(path, url).href);
      expect(await response!.text()).toContain(
        'data-testid="organization-not-found"',
      );
      await expect(page.getByTestId("organization-not-found")).toBeVisible();
      await expect(page.locator("input")).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Go to ServiceStart" }),
      ).toHaveAttribute("href", `${url.protocol}//lvh.me:${url.port}`);
    });
  }
}
