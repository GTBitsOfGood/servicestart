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
  announcements,
  shifts,
  shiftRSVPs,
  events,
  eventRsvps,
  media,
  MediaType,
} from "@/lib/schema";
import { testClient } from "hono/testing";
import app from "@/app/api/[[...route]]/route";

export const testApi = testClient(app).api;

export const DEFAULT_TEST_PASSWORD = "password123";

export const baseTestUser = {
  email: "test@example.com",
  password: DEFAULT_TEST_PASSWORD,
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
    password: DEFAULT_TEST_PASSWORD,
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
    headers: { Cookie: res.headers.get("set-cookie")! },
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
 * Creates an announcement for an organization.
 */
export async function createAnnouncement(
  organizationId: string,
  opts: {
    name?: string;
    body?: string;
    draft?: boolean;
    publishedById?: string | null;
  } = {},
) {
  const id = randomUUID();
  const isDraft = opts.draft ?? false;
  await db.insert(announcements).values({
    id,
    organizationId,
    name: opts.name ?? "Test Announcement",
    body: opts.body ?? "Test body",
    publishedAt: isDraft ? null : new Date(),
    publishedById: isDraft ? null : (opts.publishedById ?? null),
  });
  return id;
}

export async function createShift(
  organizationId: string,
  opts: {
    name?: string;
    description?: string;
    startTimestamp?: Date;
    duration?: number;
    rsvpLimit?: number;
    eventId?: string;
  } = {},
) {
  const id = randomUUID();
  const eventId = opts.eventId ?? (await createEvent(organizationId));
  await db.insert(shifts).values({
    id,
    organizationId,
    eventId,
    name: opts.name ?? "Test Shift",
    description: opts.description ?? "Test Description",
    startTimestamp: opts.startTimestamp ?? new Date(),
    duration: String(opts.duration ?? 60),
    rsvpLimit: opts.rsvpLimit ?? null,
  });
  return id;
}

export async function createShiftRSVP(shiftId: string, userId: string) {
  await db.insert(shiftRSVPs).values({
    shiftId,
    userId,
  });
}
/**
 * Creates an event for an organization.
 */
export async function createEvent(
  organizationId: string,
  opts: {
    name?: string;
    location?: string;
    description?: string | null;
    startTimestamp?: Date | null;
    duration?: string | null;
    coverImageUrl?: string | null;
  } = {},
) {
  const id = randomUUID();
  await db.insert(events).values({
    id,
    organizationId,
    name: opts.name ?? "Test Event",
    location: opts.location ?? "Test Location",
    description: opts.description ?? null,
    startTimestamp: opts.startTimestamp ?? null,
    duration: opts.duration ?? null,
    coverImageUrl: opts.coverImageUrl ?? null,
  });
  return id;
}

export async function createEventRSVP(eventId: string, userId: string) {
  await db.insert(eventRsvps).values({
    eventId,
    userId,
  });
}

/**
 * Creates a media record for an organization.
 * Does not create the actual file on disk - use for GET/PATCH/DELETE tests.
 */
export async function createMedia(
  organizationId: string,
  opts: {
    title?: string;
    fileName?: string;
    altText?: string;
  } = {},
) {
  const id = randomUUID();
  await db.insert(media).values({
    id,
    organizationId,
    title: opts.title ?? "Test Media",
    fileName: opts.fileName ?? "test.jpg",
    type: MediaType.Image,
    altText: opts.altText ?? "",
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
