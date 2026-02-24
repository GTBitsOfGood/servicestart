import type { Page } from "@playwright/test";
import { buildTestUser, signUpAndGetHeaders } from "../unit/testUtils";

type SignInOptions = {
  baseUrl?: string;
};

function getCookieParts(cookieHeader: string) {
  const firstPart = cookieHeader.split(";")[0];
  const [name, ...valueParts] = firstPart.split("=");
  return { name, value: valueParts.join("=") };
}

/**
 * Creates a test user via server-side helper and signs them in by
 * setting the auth cookie in the browser context.
 */
export async function createTestUserAndSignIn(
  page: Page,
  options: SignInOptions = {},
) {
  const user = buildTestUser();
  const { headers } = await signUpAndGetHeaders(user);
  const cookieHeader = headers["Cookie"];

  if (!cookieHeader) {
    throw new Error("No auth cookie returned when signing up test user.");
  }

  const { name, value } = getCookieParts(cookieHeader);

  const baseUrl =
    options.baseUrl || process.env.BASE_URL || "http://localhost:3000";
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

  return { user };
}
