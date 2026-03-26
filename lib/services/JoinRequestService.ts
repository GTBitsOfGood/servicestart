import { randomUUID } from "node:crypto";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq } from "drizzle-orm";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { OrganizationsService } from "./OrganizationService";
import { MembersService } from "./MemberService";
import {
  joinRequests,
  joinRequestHistory,
  JoinRequestStatus,
  users,
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
  options?: { limit?: number; offset?: number },
) {
  let query = db
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
      organizationId: joinRequests.organizationId,
    })
    .from(joinRequests)
    .innerJoin(users, eq(joinRequests.userId, users.id))
    .where(eq(joinRequests.organizationId, organizationId))
    .orderBy(desc(joinRequests.createdAt));

  if (options?.limit !== undefined) {
    query = query.limit(options.limit) as any;
  }
  const results = await query;

  const requestsWithHistory = await Promise.all(
    results.map(async (jr) => {
      const history = await listHistory(jr.id);
      const organization = await OrganizationsService.findById(
        jr.organizationId,
      );
      return {
        ...jr,
        history,
        organization: organization?.name ?? "Unknown Organization",
      };
    }),
  );

  return requestsWithHistory;
}

async function listHistory(joinRequestId: string) {
  const historyResolvers = alias(users, "history_resolver");
  return db
    .select({
      id: joinRequestHistory.id,
      action: joinRequestHistory.action,
      resolvedByName: historyResolvers.name,
      resolvedAt: joinRequestHistory.resolvedAt,
      denialReason: joinRequestHistory.denialReason,
    })
    .from(joinRequestHistory)
    .leftJoin(
      historyResolvers,
      eq(joinRequestHistory.resolvedByUserId, historyResolvers.id),
    )
    .where(eq(joinRequestHistory.joinRequestId, joinRequestId))
    .orderBy(desc(joinRequestHistory.resolvedAt));
}

export type JoinRequestWithUser = Awaited<
  ReturnType<typeof listByOrganization>
>[number];

export type JoinRequestHistoryEntry = Awaited<
  ReturnType<typeof listHistory>
>[number];

async function addHistoryEntry(
  joinRequestId: string,
  action: "approved" | "denied" | "removed",
  resolvedByUserId: string,
  denialReason?: string,
) {
  await db.insert(joinRequestHistory).values({
    id: randomUUID(),
    joinRequestId,
    action,
    resolvedByUserId,
    denialReason: denialReason ?? null,
  });
}

async function updateStatus(
  joinRequestId: string,
  newStatus: JoinRequestStatus,
  resolvedByUserId: string,
  denialReason?: string,
  currentStatus?: JoinRequestStatus,
  headers?: any,
) {
  let action: "approved" | "denied" | "removed" = "denied";
  if (newStatus === JoinRequestStatus.Approved) {
    action = "approved";
  } else if (
    newStatus === JoinRequestStatus.Pending &&
    currentStatus === JoinRequestStatus.Approved
  ) {
    action = "removed";
  }

  await db
    .update(joinRequests)
    .set({
      status: newStatus,
      denialReason: denialReason ?? null,
    })
    .where(eq(joinRequests.id, joinRequestId));

  const [jr] = await db
    .select()
    .from(joinRequests)
    .where(eq(joinRequests.id, joinRequestId))
    .limit(1);

  if (jr) {
    if (
      newStatus === JoinRequestStatus.Approved &&
      currentStatus !== JoinRequestStatus.Approved
    ) {
      await auth.api.addMember({
        body: {
          organizationId: jr.organizationId,
          userId: jr.userId,
          role: "member",
        },
        headers,
      });
    } else if (
      newStatus !== JoinRequestStatus.Approved &&
      currentStatus === JoinRequestStatus.Approved
    ) {
      const membership = await MembersService.findByUserAndOrganization(
        jr.userId,
        jr.organizationId,
      );
      if (membership) {
        await auth.api.removeMember({
          body: {
            organizationId: jr.organizationId,
            memberIdOrEmail: membership.id,
          },
          headers,
        });
      }
    }
  }

  await addHistoryEntry(joinRequestId, action, resolvedByUserId, denialReason);

  return jr;
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
  listHistory,
  addHistoryEntry,
  updateStatus,
  deleteById,
  create,
};
