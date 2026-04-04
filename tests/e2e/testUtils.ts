import { expect, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { organizations } from "@/lib/schema";
import { JoinRequestsService } from "@/lib/services/JoinRequestService";
import {
  addMember,
  buildTestUser,
  createJoinRequest,
  createOrganization,
  setActiveOrganization,
  signUpAndGetHeaders,
  signUpAndGetSession,
} from "../unit/testUtils";

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

/**
 * Creates a test user, an organization, makes the user an admin of that org,
 * sets the active organization on the session, and signs them into the browser.
 */
export async function createTestAdminAndSignIn(
  page: Page,
  options: SignInOptions = {},
) {
  const user = buildTestUser();
  const { session, headers } = await signUpAndGetSession(user);
  const slug = `e2e-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const org = await createOrganization(slug);
  await addMember(session.userId, org.id, "admin");
  await setActiveOrganization(session.id, org.id);

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

  return { user, org };
}

/**
 * Ensures an organization with slug `servicestart` exists so localhost
 * resolves to the default tenant (`getActiveOrganizationIdFromHeaders`).
 */
export async function ensureServicestartOrganization() {
  const [existing] = await db
    .select({ id: organizations.id, slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.slug, "servicestart"))
    .limit(1);
  if (existing) {
    return existing;
  }
  try {
    return await createOrganization("servicestart");
  } catch {
    const [again] = await db
      .select({ id: organizations.id, slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.slug, "servicestart"))
      .limit(1);
    if (!again) {
      throw new Error("Failed to ensure servicestart organization");
    }
    return again;
  }
}

/**
 * Signs in a new user who has a pending join request for the default host org.
 * Join requests are inserted explicitly: `signUpEmail` from tests does not pass
 * request headers into the session hook, so `afterUserCreated` often runs without
 * a Host header and may not create a row reliably.
 */
export async function createTestUserWithPendingJoinRequestAndSignIn(
  page: Page,
  options: SignInOptions = {},
) {
  const org = await ensureServicestartOrganization();
  const credentials = buildTestUser();
  const { user: createdUser, headers } = await signUpAndGetHeaders(credentials);

  const existing = await JoinRequestsService.findByUserAndOrganization(
    createdUser.id,
    org.id,
  );
  if (!existing) {
    await createJoinRequest(createdUser.id, org.id);
  }

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

  return { user: credentials };
}

function normalizedPathname(url: string): string {
  const pathname = new URL(url).pathname;
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}

function pathnamesEqual(
  actualUrl: string | URL,
  expectedPath: string,
): boolean {
  const href = typeof actualUrl === "string" ? actualUrl : actualUrl.href;
  const expected = expectedPath.startsWith("/")
    ? expectedPath
    : `/${expectedPath}`;
  return normalizedPathname(href) === normalizedPathname(expected);
}

/**
 * Creates a test user, adds them as a non-admin member of the default host org
 * (`servicestart`), sets the active organization on the session, and signs them in.
 */
export async function createTestMemberAndSignIn(
  page: Page,
  options: SignInOptions = {},
) {
  const org = await ensureServicestartOrganization();
  const user = buildTestUser();
  const { session, headers } = await signUpAndGetSession(user);
  await addMember(session.userId, org.id, "member");
  await setActiveOrganization(session.id, org.id);

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

  return { user, org };
}

/**
 * For routes that require an approved organization member: guests are sent to
 * `/login`, and users with a pending join request for the host org are sent to
 * `/joinrequeststatus`.
 */
export async function expectPageRedirectsUnlessApprovedMember(
  page: Page,
  path: string,
) {
  await page.context().clearCookies();
  await page.goto(path);
  await expect(page).toHaveURL(/\/login/);

  await createTestUserWithPendingJoinRequestAndSignIn(page);
  await page.goto(path);
  await expect(page).toHaveURL(/\/joinrequeststatus/);
}

/**
 * For routes that require sign-in but still allow users with a pending join
 * request: guests are sent to `/login`; pending users remain on `path`.
 */
export async function expectPageRedirectsGuestButAllowsPendingJoin(
  page: Page,
  path: string,
) {
  await page.context().clearCookies();
  await page.goto(path);
  await expect(page).toHaveURL(/\/login/);

  await createTestUserWithPendingJoinRequestAndSignIn(page);
  await page.goto(path);
  await expect(page).toHaveURL((url) => pathnamesEqual(url, path));
}

/**
 * For admin-only routes (same membership rules as `redirectIfNotAdmin` in authUtils):
 * guests → `/login`, pending join → `/joinrequeststatus`, approved non-admins → `/`.
 */
export async function expectPageRedirectsUnlessAdmin(page: Page, path: string) {
  await page.context().clearCookies();
  await page.goto(path);
  await expect(page).toHaveURL(/\/login/);

  await createTestUserWithPendingJoinRequestAndSignIn(page);
  await page.goto(path);
  await expect(page).toHaveURL(/\/joinrequeststatus/);

  await page.context().clearCookies();
  await createTestMemberAndSignIn(page);
  await page.goto(path);
  await expect(page).toHaveURL((url) => pathnamesEqual(url, "/"));

  await page.context().clearCookies();
  await createTestAdminAndSignIn(page);
  await page.goto(path);
  await expect(page).toHaveURL((url) => pathnamesEqual(url, path));
}

/**
 * Asserts that guests, pending-join users, members, and admins all remain on
 * `path` after navigation (no auth redirect). Use for routes that do not gate
 * on session (for example static files under `/public`).
 */
export async function expectPageDoesNotRedirect(page: Page, path: string) {
  await page.context().clearCookies();
  await page.goto(path);
  await expect(page).toHaveURL((url) => pathnamesEqual(url, path));

  await createTestUserWithPendingJoinRequestAndSignIn(page);
  await page.goto(path);
  await expect(page).toHaveURL((url) => pathnamesEqual(url, path));

  await page.context().clearCookies();
  await createTestMemberAndSignIn(page);
  await page.goto(path);
  await expect(page).toHaveURL((url) => pathnamesEqual(url, path));

  await page.context().clearCookies();
  await createTestAdminAndSignIn(page);
  await page.goto(path);
  await expect(page).toHaveURL((url) => pathnamesEqual(url, path));
}
