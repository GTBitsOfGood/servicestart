import { expect, test } from "@playwright/test";

// One server/build serves both tenant hosts. Do not intercept the config API:
// the browser must be able to read its real 404 from the visited origin.
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
      const responsePromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/organizationConfig",
      );
      await page.goto(new URL(path, url).href);
      const response = await responsePromise;
      expect(new URL(response.url()).origin).toBe(url.origin);
      expect(response.status()).toBe(404);
      await expect(page.getByTestId("organization-not-found")).toBeVisible();
      await expect(page.locator("input")).toHaveCount(0);
    });
  }
}
