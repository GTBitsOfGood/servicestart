import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import db from "@/lib/db";
import { joinRequests, JoinRequestStatus, users } from "@/lib/schema";

async function findByUserAndOrganization(
  userId: string,
  organizationId: string,
) {
  const [joinRequest] = await db
    .select({
      id: joinRequests.id,
      status: joinRequests.status,
      createdAt: joinRequests.createdAt,
    })
    .from(joinRequests)
    .where(
      and(
        eq(joinRequests.userId, userId),
        eq(joinRequests.organizationId, organizationId),
      ),
    )
    .limit(1);

  return joinRequest ?? null;
}

async function findByIdAndOrganization(
  joinRequestId: string,
  organizationId: string,
) {
  const [joinRequest] = await db
    .select({
      id: joinRequests.id,
      userId: joinRequests.userId,
      organizationId: joinRequests.organizationId,
      status: joinRequests.status,
    })
    .from(joinRequests)
    .where(eq(joinRequests.id, joinRequestId))
    .limit(1);

  if (!joinRequest || joinRequest.organizationId !== organizationId) {
    return null;
  }

  return joinRequest;
}

async function findById(joinRequestId: string) {
  const [joinRequest] = await db
    .select({
      id: joinRequests.id,
      userId: joinRequests.userId,
      organizationId: joinRequests.organizationId,
      status: joinRequests.status,
    })
    .from(joinRequests)
    .where(eq(joinRequests.id, joinRequestId))
    .limit(1);

  return joinRequest ?? null;
}

async function listByOrganization(organizationId: string) {
  return db
    .select({
      id: joinRequests.id,
      status: joinRequests.status,
      denialReason: joinRequests.denialReason,
      createdAt: joinRequests.createdAt,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        displayName: users.displayName,
        pronouns: users.pronouns,
        location: users.location,
      },
    })
    .from(joinRequests)
    .innerJoin(users, eq(joinRequests.userId, users.id))
    .where(eq(joinRequests.organizationId, organizationId))
    .orderBy(desc(joinRequests.createdAt));
}

export type JoinRequestWithUser = Awaited<
  ReturnType<typeof listByOrganization>
>[number];

async function updateStatus(
  joinRequestId: string,
  status: JoinRequestStatus,
  denialReason?: string,
) {
  await db
    .update(joinRequests)
    .set({ status, denialReason: denialReason ?? null })
    .where(eq(joinRequests.id, joinRequestId));

  const [updated] = await db
    .select({
      id: joinRequests.id,
      userId: joinRequests.userId,
      status: joinRequests.status,
      denialReason: joinRequests.denialReason,
      createdAt: joinRequests.createdAt,
    })
    .from(joinRequests)
    .where(eq(joinRequests.id, joinRequestId))
    .limit(1);

  return updated ?? null;
}

async function deleteById(joinRequestId: string) {
  await db.delete(joinRequests).where(eq(joinRequests.id, joinRequestId));
}

async function create(userId: string, organizationId: string) {
  const id = randomUUID();
  await db.insert(joinRequests).values({
    id,
    userId,
    organizationId,
    status: JoinRequestStatus.Pending,
  });
  return id;
}

export const JoinRequestsService = {
  findByUserAndOrganization,
  findByIdAndOrganization,
  findById,
  listByOrganization,
  updateStatus,
  deleteById,
  create,
};
