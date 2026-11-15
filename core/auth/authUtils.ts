import "server-only";
import {
  resolveOrganization,
  assertOrganizationMatchesHost,
} from "@/core/tenant/resolveOrganization";
import { ORGANIZATION_NOT_FOUND_PATH } from "@/core/tenant/organizationRoutes";
import type { Context } from "hono";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/core/auth/auth";
import {
  ForbiddenError,
  NoActiveOrganizationError,
  UnauthorizedError,
} from "@/core/api/errors";
import { OrganizationsService } from "@/core/tenant/OrganizationService";
import { UserService } from "@/core/auth/UserService";
import { findMembership, isAdminOrOwner } from "@/core/auth/membership";
import { User } from "better-auth";
import db from "@/core/db";
import { users } from "@/core/auth/schema";

type AppSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

type SessionWithOrganization = AppSession & {
  organizationId: string;
};

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

  await assertOrganizationMatchesHost(c, session);
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

  const membership = await findMembership(session.user.id, organizationId);

  if (!membership) {
    throw new ForbiddenError();
  }

  return session;
}

/**
 * Returns the current session only if the user has an active organization
 * and is an admin/owner of it; otherwise throws an auth-related error.
 */
export async function requireAdmin(c: Context, message = "Forbidden") {
  return requireAdminSession(await requireAuth(c), message);
}

/** Check an already authenticated session without loading or validating it twice. */
export async function requireAdminSession(
  session: AppSession,
  message = "Forbidden",
) {
  const organizationId = session.session.activeOrganizationId;

  if (!organizationId) {
    throw new NoActiveOrganizationError();
  }

  const membership = await findMembership(session.user.id, organizationId);

  if (!isAdminOrOwner(membership?.role)) {
    throw new ForbiddenError(message);
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

  return (await resolveOrganization(headers, session))?.id ?? null;
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

  const membership = await findMembership(session.user.id, organizationId);

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

  const membership = await findMembership(session.user.id, organizationId);

  if (!isAdminOrOwner(membership?.role)) {
    redirect("/");
  }

  return {
    ...session,
    organizationId,
  } satisfies SessionWithOrganization;
}
