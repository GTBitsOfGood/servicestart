import "server-only";
import { and, eq, gt, inArray, isNotNull } from "drizzle-orm";
import db from "@/core/db";
import {
  eventRsvps,
  events,
  joinRequests,
  joinRequestHistory,
  JoinRequestStatus,
  shiftRSVPs,
  shifts,
} from "@/core/db/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import { UserService } from "@/core/auth/UserService";
import { INVITATION_ID_HEADER } from "@/core/tenant/clientAuthUtils";
import { resolveOrganization } from "@/core/tenant/resolveOrganization";
import { InvitationService } from "./InvitationService";
import { JoinRequestsService } from "./JoinRequestService";
import { MembersService } from "./MemberService";

/*
 * The membership side of BetterAuth's lifecycle. core/auth/auth.ts calls these
 * through the hook registry in core/auth/authHooks.ts; ../authHooks.ts
 * registers them.
 */

/**
 * Accepts the invitation the user signed up from (the `x-invitation-id`
 * header the invitation page sends) if it's theirs; otherwise files a join
 * request with the host's organization.
 */
export async function afterUserCreated(
  userId: string,
  headers?: Headers,
): Promise<void> {
  try {
    const organization = await resolveOrganization(headers ?? new Headers());
    if (!organization) return;

    const membership = await MembersService.findByUserAndOrganization(
      userId,
      organization.id,
    );
    if (membership) return;

    // Only a sign-up from the invitation link accepts it: an email match
    // alone would let anyone who knows the address claim the invited role.
    const invitationId = headers?.get(INVITATION_ID_HEADER);
    if (invitationId) {
      const user = await UserService.findById(userId);
      const role =
        user &&
        (await InvitationService.acceptForUser(
          invitationId,
          organization.id,
          user,
        ));
      if (role) return;
    }

    const autoApprove = await OrganizationConfigService.getAutoApproveSignups(
      organization.id,
    );
    const user = await UserService.findById(userId);
    const pendingInvite =
      user &&
      (await InvitationService.hasPendingForEmail(organization.id, user.email));
    if (!autoApprove || pendingInvite) {
      await JoinRequestsService.createIfNeeded(userId, organization.id);
      return;
    }
    const existingRequest = await JoinRequestsService.findByUserAndOrganization(
      userId,
      organization.id,
    );
    if (existingRequest) return;
    await MembersService.addSignupMember(userId, organization.id);
    await JoinRequestsService.create(
      userId,
      organization.id,
      JoinRequestStatus.Approved,
    );
  } catch (err) {
    console.error(err);
  }
}

/**
 * Before a member is removed: records the removal and cancels their RSVPs to
 * upcoming events and shifts.
 */
export async function beforeRemoveMember(member: {
  userId: string;
  organizationId: string;
}): Promise<void> {
  const now = new Date();

  // Records the removal so auto-approve doesn't re-add them on their
  // next login. Leaves an existing request alone (the join request
  // "remove" flow has already moved it back to pending).
  const [existingRequest] = await db
    .select({ id: joinRequests.id, status: joinRequests.status })
    .from(joinRequests)
    .where(
      and(
        eq(joinRequests.userId, member.userId),
        eq(joinRequests.organizationId, member.organizationId),
      ),
    )
    .limit(1);
  if (!existingRequest) {
    await db.insert(joinRequests).values({
      id: crypto.randomUUID(),
      userId: member.userId,
      organizationId: member.organizationId,
      status: JoinRequestStatus.Denied,
    });
  }

  if (existingRequest?.status === JoinRequestStatus.Pending) {
    const history = await JoinRequestsService.listHistory(existingRequest.id);
    if (!history.some((entry) => entry.action === "removed")) {
      // An invite may have been accepted while a join request was
      // pending. Preserve removal history when access is revoked.
      await db.insert(joinRequestHistory).values({
        id: crypto.randomUUID(),
        joinRequestId: existingRequest.id,
        action: "removed",
      });
    }
  }

  await Promise.all([
    db.delete(eventRsvps).where(
      and(
        eq(eventRsvps.userId, member.userId),
        inArray(
          eventRsvps.eventId,
          db
            .select({ id: events.id })
            .from(events)
            .where(
              and(
                eq(events.organizationId, member.organizationId),
                gt(events.startTimestamp, now),
                isNotNull(events.startTimestamp),
              ),
            ),
        ),
      ),
    ),

    db.delete(shiftRSVPs).where(
      and(
        eq(shiftRSVPs.userId, member.userId),
        inArray(
          shiftRSVPs.shiftId,
          db
            .select({ id: shifts.id })
            .from(shifts)
            .where(
              and(
                eq(shifts.organizationId, member.organizationId),
                gt(shifts.startTimestamp, now),
              ),
            ),
        ),
      ),
    ),
  ]);
}
