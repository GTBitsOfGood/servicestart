import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import {
  joinRequests,
  JoinRequestStatus,
  members,
  organizations,
  sessions,
} from "@/lib/schema";
import { testClient } from "hono/testing";
import app from "@/app/api/[[...route]]/route";

export const testApi = testClient(app).api;

export const baseTestUser = {
  email: "test@example.com",
  password: "password123",
  name: "Test User",
};

/**
 * Builds a test user object with a unique email and name.
 * Does not create the user in the database.
 */
export function buildTestUser() {
  const seed = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  return {
    name: `Test User ${seed}`,
    email: `test-${seed}@example.com`,
    password: "password123",
  };
}

/**
 * Builds a host header value for a given organization slug.
 */
export function buildHost(slug: string) {
  return `${slug}.servicestart.com`;
}

/**
 * Creates an organization in the database.
 */
export async function createOrganization(slug: string) {
  const id = randomUUID();
  await db.insert(organizations).values({
    id,
    name: `Organization ${slug}`,
    slug,
  });

  return { id, slug };
}

/**
 * Signs up a test user and returns the user with auth headers.
 */
export async function signUpAndGetHeaders(
  user: ReturnType<typeof buildTestUser>,
) {
  const res = await auth.api.signUpEmail({
    body: user,
    returnHeaders: true,
  });

  return {
    user: res.response.user,
    headers: new Headers({ Cookie: res.headers.get("set-cookie")! }),
  };
}

/**
 * Signs up a test user and returns the user, session, and auth headers.
 */
export async function signUpAndGetSession(
  user: ReturnType<typeof buildTestUser>,
) {
  const res = await auth.api.signUpEmail({
    body: user,
    returnHeaders: true,
  });

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, res.response.user.id))
    .limit(1);

  return {
    user: res.response.user,
    session,
    headers: new Headers({ Cookie: res.headers.get("set-cookie")! }),
  };
}

/**
 * Sets the active organization for a session.
 */
export async function setActiveOrganization(
  sessionId: string,
  organizationId: string,
) {
  await db
    .update(sessions)
    .set({ activeOrganizationId: organizationId })
    .where(eq(sessions.id, sessionId));
}

/**
 * Adds a user as a member to an organization with a given role.
 */
export async function addMember(
  userId: string,
  organizationId: string,
  role: string,
) {
  await db.insert(members).values({
    id: randomUUID(),
    userId,
    organizationId,
    role,
  });
}

/**
 * Creates a join request for a user to an organization.
 */
export async function createJoinRequest(
  userId: string,
  organizationId: string,
  status: JoinRequestStatus = JoinRequestStatus.Pending,
) {
  const id = randomUUID();
  await db.insert(joinRequests).values({
    id,
    userId,
    organizationId,
    status,
  });
  return id;
}

/**
 * @deprecated Use buildTestUser + signUpAndGetHeaders instead
 * Signs up a test user, which you can use to run API routes.
 */
export async function createTestUser() {
  const userNumber = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

  const user: typeof baseTestUser = {
    ...baseTestUser,
    email: `testuser${userNumber}@example.com`,
    name: `Test User ${userNumber}`,
  };

  const res = await auth.api.signUpEmail({
    body: user,
    returnHeaders: true,
  });

  if (!res.response.user || !res.response.token) {
    throw new Error("Failed to create test user");
  }

  if (!res.headers.get("set-cookie")) {
    throw new Error("No set-cookie header found");
  }

  return {
    user: res.response.user,
    token: res.response.token!,
    headers: {
      Cookie: res.headers.get("set-cookie")!,
    },
  };
}
