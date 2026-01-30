import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { joinRequests, members, organizations, sessions } from "@/lib/schema";

export function buildTestUser() {
  const seed = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  return {
    name: `Test User ${seed}`,
    email: `test-${seed}@example.com`,
    password: "password123",
  };
}

export function buildHost(slug: string) {
  return `${slug}.servicestart.com`;
}

export async function createOrganization(slug: string) {
  const id = randomUUID();
  await db.insert(organizations).values({
    id,
    name: `Organization ${slug}`,
    slug,
  });

  return { id, slug };
}

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

export async function setActiveOrganization(
  sessionId: string,
  organizationId: string,
) {
  await db
    .update(sessions)
    .set({ activeOrganizationId: organizationId })
    .where(eq(sessions.id, sessionId));
}

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

export async function createJoinRequest(
  userId: string,
  organizationId: string,
  status: "pending" | "approved" | "denied" = "pending",
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
