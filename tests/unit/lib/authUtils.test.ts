import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "hono";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { joinRequests, JoinRequestStatus, members } from "@/lib/schema";
import {
  ForbiddenError,
  NoActiveOrganizationError,
  UnauthorizedError,
} from "@/lib/errors";
import {
  redirectIfNotAdmin,
  redirectIfNotMember,
  requireAdmin,
  requireAuth,
  requireMembership,
} from "@/lib/authUtils";
import {
  addMember,
  buildHost,
  buildTestUser,
  createOrganization,
  createJoinRequest,
  setActiveOrganization,
  signUpAndGetSession,
} from "../testUtils";

const mockHeaders = vi.fn();
const mockRedirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock("next/headers", () => ({
  headers: () => mockHeaders(),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => mockRedirect(path),
}));

async function getJoinRequests(userId: string, organizationId: string) {
  return db
    .select()
    .from(joinRequests)
    .where(
      and(
        eq(joinRequests.userId, userId),
        eq(joinRequests.organizationId, organizationId),
      ),
    );
}

describe("join request hooks", () => {
  it("creates a join request for the subdomain slug on sign up", async () => {
    const organization = await createOrganization("acme");
    const user = buildTestUser();

    const result = await auth.api.signUpEmail({
      body: { ...user, organizationSlug: "acme" },
      headers: { host: buildHost("acme"), "x-organization-slug": "acme" },
    });

    const requests = await getJoinRequests(result.user.id, organization.id);

    expect(requests).toHaveLength(1);
    expect(requests[0].status).toBe(JoinRequestStatus.Pending);
  });

  it("defaults the slug to servicestart when host is not a subdomain", async () => {
    const organization = await createOrganization("servicestart");
    const user = buildTestUser();

    const result = await auth.api.signUpEmail({
      body: { ...user, organizationSlug: "servicestart" },
      headers: {
        host: "servicestart.com",
        "x-organization-slug": "servicestart",
      },
    });

    const requests = await getJoinRequests(result.user.id, organization.id);

    expect(requests).toHaveLength(1);
  });

  it("does not create a join request when the user is already a member", async () => {
    const organization = await createOrganization("acme");
    const user = buildTestUser();

    const signUpResult = await auth.api.signUpEmail({
      body: { ...user, organizationSlug: "acme" },
      headers: { host: buildHost("acme"), "x-organization-slug": "acme" },
    });

    await db
      .delete(joinRequests)
      .where(eq(joinRequests.userId, signUpResult.user.id));

    await db.insert(members).values({
      id: randomUUID(),
      userId: signUpResult.user.id,
      organizationId: organization.id,
      role: "member",
    });

    await auth.api.signInEmail({
      body: {
        email: user.email,
        password: user.password,
      },
      headers: { host: buildHost("acme") },
    });

    const requests = await getJoinRequests(
      signUpResult.user.id,
      organization.id,
    );

    expect(requests).toHaveLength(0);
  });

  it("does not create duplicate join requests on sign in", async () => {
    const organization = await createOrganization("acme");
    const user = buildTestUser();

    const signUpResult = await auth.api.signUpEmail({
      body: { ...user, organizationSlug: "acme" },
      headers: { host: buildHost("acme"), "x-organization-slug": "acme" },
    });

    await auth.api.signInEmail({
      body: {
        email: user.email,
        password: user.password,
      },
      headers: { host: buildHost("acme") },
    });

    const requests = await getJoinRequests(
      signUpResult.user.id,
      organization.id,
    );

    expect(requests).toHaveLength(1);
  });
});

function buildContext(headers?: Record<string, string>) {
  return {
    req: {
      header: () => headers ?? {},
    },
  } as unknown as Context;
}

describe("auth guard helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockReturnValue(new Headers());
  });

  it("requireAuth throws UnauthorizedError when not signed in", async () => {
    const context = buildContext();

    await expect(requireAuth(context)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("requireAuth returns session when signed in", async () => {
    const user = buildTestUser();
    const { headers } = await signUpAndGetSession(user);
    const context = buildContext({ Cookie: headers.Cookie });

    const session = await requireAuth(context);
    expect(session.user.id).toBeDefined();
  });

  it("requireMembership throws NoActiveOrganizationError without active org", async () => {
    const user = buildTestUser();
    const { headers } = await signUpAndGetSession(user);
    const context = buildContext({ Cookie: headers.Cookie });

    await expect(requireMembership(context)).rejects.toBeInstanceOf(
      NoActiveOrganizationError,
    );
  });

  it("requireMembership throws ForbiddenError when not a member", async () => {
    const user = buildTestUser();
    const organization = await createOrganization("acme");
    const { session, headers } = await signUpAndGetSession(user);
    await setActiveOrganization(session.id, organization.id);
    const context = buildContext({ Cookie: headers.Cookie });

    await expect(requireMembership(context)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("requireMembership returns session for member", async () => {
    const user = buildTestUser();
    const organization = await createOrganization("acme");
    const {
      user: signedInUser,
      session,
      headers,
    } = await signUpAndGetSession(user);
    await addMember(signedInUser.id, organization.id, "member");
    await setActiveOrganization(session.id, organization.id);
    const context = buildContext({ Cookie: headers.Cookie });

    const result = await requireMembership(context);
    expect(result.user.id).toBe(signedInUser.id);
  });

  it("requireAdmin throws ForbiddenError when not admin or owner", async () => {
    const user = buildTestUser();
    const organization = await createOrganization("acme");
    const {
      user: signedInUser,
      session,
      headers,
    } = await signUpAndGetSession(user);
    await addMember(signedInUser.id, organization.id, "member");
    await setActiveOrganization(session.id, organization.id);
    const context = buildContext({ Cookie: headers.Cookie });

    await expect(requireAdmin(context)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("requireAdmin returns session for admin", async () => {
    const user = buildTestUser();
    const organization = await createOrganization("acme");
    const {
      user: signedInUser,
      session,
      headers,
    } = await signUpAndGetSession(user);
    await addMember(signedInUser.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);
    const context = buildContext({ Cookie: headers.Cookie });

    const result = await requireAdmin(context);
    expect(result.user.id).toBe(signedInUser.id);
  });

  it("redirectIfNotMember redirects unauthenticated users to /login", async () => {
    await expect(redirectIfNotMember()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("redirectIfNotMember redirects pending join requests to /joinrequeststatus", async () => {
    const user = buildTestUser();
    const organization = await createOrganization("acme");
    const { user: signedInUser, headers } = await signUpAndGetSession(user);
    await createJoinRequest(
      signedInUser.id,
      organization.id,
      JoinRequestStatus.Pending,
    );

    mockHeaders.mockReturnValue(
      new Headers({
        cookie: headers.Cookie,
        host: buildHost("acme"),
      }),
    );

    await expect(redirectIfNotMember()).rejects.toThrow(
      "NEXT_REDIRECT:/joinrequeststatus",
    );
    expect(mockRedirect).toHaveBeenCalledWith("/joinrequeststatus");
  });

  it("redirectIfNotAdmin redirects signed-in non-admin members to /", async () => {
    const user = buildTestUser();
    const organization = await createOrganization("acme");
    const {
      user: signedInUser,
      session,
      headers,
    } = await signUpAndGetSession(user);
    await addMember(signedInUser.id, organization.id, "member");
    await setActiveOrganization(session.id, organization.id);

    mockHeaders.mockReturnValue(
      new Headers({
        cookie: headers.Cookie,
        host: buildHost("acme"),
      }),
    );

    await expect(redirectIfNotAdmin()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("redirectIfNotMember returns session for valid members", async () => {
    const user = buildTestUser();
    const organization = await createOrganization("acme");
    const {
      user: signedInUser,
      session,
      headers,
    } = await signUpAndGetSession(user);
    await addMember(signedInUser.id, organization.id, "member");
    await setActiveOrganization(session.id, organization.id);

    mockHeaders.mockReturnValue(
      new Headers({
        cookie: headers.Cookie,
        host: buildHost("acme"),
      }),
    );

    const result = await redirectIfNotMember();
    expect(result.user.id).toBe(signedInUser.id);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirectIfNotAdmin returns session for admins", async () => {
    const user = buildTestUser();
    const organization = await createOrganization("acme");
    const {
      user: signedInUser,
      session,
      headers,
    } = await signUpAndGetSession(user);
    await addMember(signedInUser.id, organization.id, "owner");
    await setActiveOrganization(session.id, organization.id);

    mockHeaders.mockReturnValue(
      new Headers({
        cookie: headers.Cookie,
        host: buildHost("acme"),
      }),
    );

    const result = await redirectIfNotAdmin();
    expect(result.user.id).toBe(signedInUser.id);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
