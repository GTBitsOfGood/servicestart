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
import { getSlugFromHost } from "./clientAuthUtils";

export async function createJoinRequestIfNeeded(userId: string, host?: string) {
  const slug = getSlugFromHost(host);

  const organization = await OrganizationsService.findBySlug(slug);
  if (!organization) return;

  const membership = await MembersService.findByUserAndOrganization(
    userId,
    organization.id,
  );
  if (membership) return;

  const existingRequest = await JoinRequestsService.findByUserAndOrganization(
    userId,
    organization.id,
  );
  if (existingRequest) return;

  await JoinRequestsService.create(userId, organization.id);
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
