import type { Context } from "hono";
import { auth } from "@/lib/auth";
import {
  ForbiddenError,
  NoActiveOrganizationError,
  UnauthorizedError,
} from "@/lib/errors";
import { JoinRequestsService } from "@/lib/services/JoinRequestService";
import { MembersService } from "@/lib/services/MemberService";
import { OrganizationsService } from "@/lib/services/OrganizationService";
import { UserService } from "@/lib/services/UserService";
import { getSlugFromHost } from "./clientAuthUtils";
import { NotificationService } from "@/lib/services/NotificationService";
import { NotificationType } from "@/lib/schema";

/**
 * Accepts invite if one exists and is pending
 */
async function acceptInviteIfAvailable(
  userId: string,
  organizationId: string,
  headers: Headers,
): Promise<boolean> {
  const user = await UserService.findById(userId);
  if (!user) return false;

  const invitations = await auth.api.listUserInvitations({
    query: { email: user.email },
    headers,
  });

  const invitation = Array.isArray(invitations)
    ? invitations.find(
        (inv: { organizationId: string; status: string; id: string }) =>
          inv.organizationId === organizationId && inv.status === "pending",
      )
    : null;

  if (!invitation) return false;

  try {
    await auth.api.acceptInvitation({
      body: { invitationId: invitation.id },
      headers,
    });
  } catch {
    return false;
  }

  return true;
}

/**
 * Creates a join request for the user if there isn't already one
 */
export async function createJoinRequestIfNeeded(
  userId: string,
  organizationId: string,
): Promise<void> {
  const existingRequest = await JoinRequestsService.findByUserAndOrganization(
    userId,
    organizationId,
  );
  if (existingRequest) return;

  const joinRequestId = await JoinRequestsService.create(
    userId,
    organizationId,
  );

  const user = await UserService.findById(userId);
  const userName = user?.name || user?.email || "A user";
  await NotificationService.notifyAdmins(
    organizationId,
    `Join Request\n${userName} has requested to join the organization.`,
    NotificationType.ActionRequired,
    { joinRequestId },
  );
}

/**
 * Accepts pending invite if it exists and adds the user to the organization
 */
export async function afterUserCreated(
  userId: string,
  headers?: Headers,
): Promise<void> {
  try {
    const host = headers?.get("host") || undefined;
    const slug = getSlugFromHost(host);
    if (!slug) return;

    const organization = await OrganizationsService.findBySlug(slug);
    if (!organization) return;

    const membership = await MembersService.findByUserAndOrganization(
      userId,
      organization.id,
    );
    if (membership) return;

    if (headers) {
      const accepted = await acceptInviteIfAvailable(
        userId,
        organization.id,
        headers,
      );
      if (accepted) return;
    }

    await createJoinRequestIfNeeded(userId, organization.id);
  } catch (err) {
    console.error("Failed to handle organization membership:", err);
  }
}
/**
 * Returns the current session or throws UnauthorizedError if not signed in.
 * Use this to avoid duplicating auth checks in route handlers.
 */
export async function requireAuth(c: Context) {
  const session = await auth.api.getSession({
    headers: c.req.header(),
  });

  if (!session?.user) {
    throw new UnauthorizedError();
  }

  return session;
}

/**
 * Returns the current session only if the user has an active organization
 * and is a member of it; otherwise throws an auth-related error.
 */
export async function requireMembership(c: Context) {
  const session = await requireAuth(c);
  const organizationId = session.session.activeOrganizationId;

  if (!organizationId) {
    throw new NoActiveOrganizationError();
  }

  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    organizationId,
  );

  if (!membership) {
    throw new ForbiddenError();
  }

  return session;
}

/**
 * Returns the current session only if the user has an active organization
 * and is an admin/owner of it; otherwise throws an auth-related error.
 */
export async function requireAdmin(c: Context) {
  const session = await requireAuth(c);
  const organizationId = session.session.activeOrganizationId;

  if (!organizationId) {
    throw new NoActiveOrganizationError();
  }

  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    organizationId,
  );

  if (!MembersService.isAdminOrOwner(membership?.role)) {
    throw new ForbiddenError();
  }

  return session;
}

/**
 * Can get the org ID on the first render after logging in
 * (when the active org ID isn't in the session yet)
 */
export async function getActiveOrganizationIdFromHeaders(
  headers: Headers,
): Promise<string | null> {
  const session = await auth.api.getSession({
    headers,
  });

  if (session?.session.activeOrganizationId) {
    return session.session.activeOrganizationId;
  }

  const slug = getSlugFromHost(headers.get("host") ?? undefined);
  if (!slug) {
    return null;
  }

  const organization = await OrganizationsService.findBySlug(slug);
  if (!organization) {
    return null;
  }

  return organization.id;
}
