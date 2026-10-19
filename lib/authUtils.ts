import { ORGANIZATION_NOT_FOUND_PATH } from "@/lib/organizationRoutes";
import type { Context } from "hono";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  ForbiddenError,
  NoActiveOrganizationError,
  UnauthorizedError,
} from "@/lib/errors";
import { JoinRequestsService } from "@/lib/services/JoinRequestService";
import { MembersService } from "@/lib/services/MemberService";
import { OrganizationsService } from "@/lib/services/OrganizationService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { UserService } from "@/lib/services/UserService";
import { User } from "better-auth";
import db from "@/lib/db";
import { users } from "@/lib/schema";
import { getSlugFromHost } from "./clientAuthUtils";
// import { User } from "better-auth/client";
import { NotificationService } from "@/lib/services/NotificationService";
import { JoinRequestStatus, MemberType, NotificationType } from "@/lib/schema";

type AppSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

type SessionWithOrganization = AppSession & {
  organizationId: string;
};

/**
 * Accepts the user's pending invite to the organization, if there is one.
 * Returns "pending" when an invite exists but couldn't be accepted.
 */
async function acceptInviteIfAvailable(
  userId: string,
  organizationId: string,
  headers: Headers,
): Promise<"accepted" | "pending" | "none"> {
  const user = await UserService.findById(userId);
  if (!user) return "none";

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

  if (!invitation) return "none";

  try {
    await auth.api.acceptInvitation({
      body: { invitationId: invitation.id },
      headers,
    });
  } catch {
    // acceptInvitation needs a session cookie, which the request creating the
    // session doesn't have yet, so this fails at signup. The invite is
    // accepted from its email link instead (#301).
    return "pending";
  }

  return "accepted";
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

    const invite = headers
      ? await acceptInviteIfAvailable(userId, organization.id, headers)
      : "none";
    if (invite === "accepted") return;

    const autoApprove = await OrganizationConfigService.getAutoApproveSignups(
      organization.id,
    );
    // A pending invite carries its own role, so don't auto-approve over it.
    if (!autoApprove || invite === "pending") {
      await createJoinRequestIfNeeded(userId, organization.id);
      return;
    }

    // Any earlier request (pending, denied, or the denied row a removal
    // records) means an admin already decided, so don't auto-approve over it.
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
 * Returns the current session only if the user is a member of the active
 * organization whose member type is in `allowed`. Admins and owners always
 * pass, and so does everyone while MemberTypesEnabled is off.
 */
export async function requireMemberType(c: Context, allowed: MemberType[]) {
  const session = await requireMembership(c);
  const organizationId = session.session.activeOrganizationId!;

  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    organizationId,
  );
  if (MembersService.isAdminOrOwner(membership?.role)) return session;

  const enabled =
    await OrganizationConfigService.getMemberTypesEnabled(organizationId);
  if (!enabled) return session;

  if (!membership?.memberType || !allowed.includes(membership.memberType)) {
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

/** Resolves a real organization or stops at the unguarded missing-org page. */
export async function requireOrganizationOrRedirect(headerList: Headers) {
  const organizationId = await getActiveOrganizationIdFromHeaders(headerList);
  if (!organizationId) redirect(ORGANIZATION_NOT_FOUND_PATH);
  return organizationId;
}

/**
 * Loads the Better Auth session for a Next.js server request. Redirects to
 * `/login` when there is no signed-in user.
 */
export async function requireSessionOrRedirect(headerList: Headers) {
  const session = await auth.api.getSession({
    headers: headerList,
  });

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

/**
 * Redirects unauthenticated users to /login and users with pending join
 * requests to /joinrequeststatus.
 */
export async function redirectIfNotMember() {
  const requestHeaders = await headers();
  const session = await requireSessionOrRedirect(requestHeaders);

  const organizationId = await requireOrganizationOrRedirect(requestHeaders);

  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    organizationId,
  );

  if (membership) {
    return {
      ...session,
      organizationId,
    } satisfies SessionWithOrganization;
  }

  redirect("/joinrequeststatus");
}

interface FindUserCtx {
  context: {
    internalAdapter: {
      findAccountByUserId: (userId: string) => Promise<unknown>;
    };
  };
}

interface CreateUserCtx {
  context: {
    organizationId?: string;
    [key: string]: unknown;
  };
}

export function findUserByEmailOverride(
  ctx: FindUserCtx,
  organizationId: string,
) {
  return async (email: string) => {
    if (!organizationId)
      throw new Error("organizationId required for multi-tenant user lookup");
    const user = await UserService.findByEmailAndOrganization(
      email,
      organizationId,
    );
    if (!user) return null;

    const accounts = await ctx.context.internalAdapter.findAccountByUserId(
      user.id,
    );

    return { user, accounts };
  };
}

export function createUserOverride(ctx: CreateUserCtx) {
  return async (user: User) => {
    let organizationId = ctx.context.organizationId;

    // Verify the organization exists for the given organizationId. If it
    // doesn't, fall back to looking up an organization by the user-provided
    // organizationSlug (if present). This handles test scenarios where the
    // ctx.organizationId may be stale or invalid.
    if (organizationId) {
      const org = await OrganizationsService.findById(organizationId);
      if (!org) {
        organizationId = undefined as unknown as string | undefined;
      }
    }

    if (!organizationId) {
      const u = user as unknown as {
        additionalFields?: { organizationSlug?: string };
      };
      const slug = u?.additionalFields?.organizationSlug;
      if (slug) {
        const org = await OrganizationsService.findBySlug(slug);
        if (org) organizationId = org.id;
      }
    }

    if (!organizationId)
      throw new Error("organizationId required for multi-tenant user creation");
    const { email, name, ...rest } = user as unknown as {
      email: string;
      name?: string;
    } & Record<string, unknown>;
    // Try to find user by email
    const existingUser = await UserService.findByEmailAndOrganization(
      email,
      organizationId,
    );
    let id: string;
    if (!existingUser) {
      // Create new user
      id = crypto.randomUUID();
      await db.insert(users).values({
        name: name || "",
        email,
        organizationId,
        ...rest,
        id,
      });
    } else {
      id = existingUser.id;
    }
    return await UserService.findById(id);
  };
}

/**
 * this function redirects non-admin users to the homepage
 */

export async function redirectIfNotAdmin() {
  const session = await redirectIfNotMember();
  const { organizationId } = session;

  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    organizationId,
  );

  if (!MembersService.isAdminOrOwner(membership?.role)) {
    redirect("/");
  }

  return {
    ...session,
    organizationId,
  } satisfies SessionWithOrganization;
}
