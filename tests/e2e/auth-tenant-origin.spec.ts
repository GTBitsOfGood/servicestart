import {
  addMember,
  buildTestUser,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
} from "../unit/testUtils";
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
      expect(response!.status()).toBe(404);
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

// No implicit ServiceStart selection on the root/preview/loopback hosts.
test("anonymous default-host auth uses platform branding without an org lookup", async ({
  page,
  baseURL,
}) => {
  const url = new URL(baseURL ?? "http://localhost:3000");
  url.hostname = "localhost";
  const lookups: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/organizationConfig")
      lookups.push(request.url());
  });
  await page.goto(new URL("/login", url).href);
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByTestId("organization-tagline")).toHaveText("Welcome");
  expect(lookups).toEqual([]);
});

test("tenant API requests reject a session active in another organization", async ({
  request,
  baseURL,
}) => {
  const suffix = Date.now().toString(36);
  const a = await createOrganization(`host-a-${suffix}`);
  const b = await createOrganization(`host-b-${suffix}`);
  const { user, session, headers } = await signUpAndGetSession(
    buildTestUser(),
    b.slug,
  );
  await addMember(user.id, a.id, "admin");
  await addMember(user.id, b.id, "admin");
  await setActiveOrganization(session.id, b.id);
  const url = new URL("/api/tags", baseURL ?? "http://localhost:3000");
  url.hostname = `${a.slug}.lvh.me`;
  const response = await request.get(url.href, { headers });
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ error: "Forbidden" });
});
