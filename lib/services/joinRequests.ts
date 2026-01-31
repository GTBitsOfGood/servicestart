import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import db from "@/lib/db";
import {
  joinRequests,
  JoinRequestStatus,
  members,
  organizations,
} from "@/lib/schema";

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

async function listByOrganization(
  organizationId: string,
  options: { limit: number; offset: number },
) {
  return db
    .select({
      id: joinRequests.id,
      userId: joinRequests.userId,
      status: joinRequests.status,
      createdAt: joinRequests.createdAt,
    })
    .from(joinRequests)
    .where(eq(joinRequests.organizationId, organizationId))
    .limit(options.limit)
    .offset(options.offset);
}

async function updateStatus(joinRequestId: string, status: JoinRequestStatus) {
  await db
    .update(joinRequests)
    .set({ status })
    .where(eq(joinRequests.id, joinRequestId));

  const [updated] = await db
    .select({
      id: joinRequests.id,
      userId: joinRequests.userId,
      status: joinRequests.status,
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

async function getUserMembership(userId: string, organizationId: string) {
  const [membership] = await db
    .select({ role: members.role })
    .from(members)
    .where(
      and(
        eq(members.userId, userId),
        eq(members.organizationId, organizationId),
      ),
    )
    .limit(1);

  return membership ?? null;
}

function isAdminOrOwner(role: string | undefined): boolean {
  const ADMIN_ROLES = ["admin", "owner"];
  return role !== undefined && ADMIN_ROLES.includes(role);
}

async function findOrganizationBySlug(slug: string) {
  const [organization] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  return organization ?? null;
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
  getUserMembership,
  isAdminOrOwner,
  findOrganizationBySlug,
  create,
};
