// @vitest-environment node
import OrganizationNotFoundPage from "@/app/organization-not-found/page";
import { renderToStaticMarkup } from "react-dom/server";
import DashboardPage from "@/app/page";
import EventsPage from "@/app/events/page";
import JoinRequestStatusPage from "@/app/joinrequeststatus/page";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "hono";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { joinRequests, JoinRequestStatus, members } from "@/lib/schema";
import { INVITATION_ID_HEADER } from "@/lib/clientAuthUtils";
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
  createInvitation,
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

describe("invitation hooks", () => {
  const HOUR_MS = 60 * 60 * 1000;

  async function signUpOnHost(
    slug: string,
    user: ReturnType<typeof buildTestUser>,
    invitationId?: string,
  ) {
    const result = await auth.api.signUpEmail({
      body: { ...user, organizationSlug: slug },
      headers: {
        host: buildHost(slug),
        "x-organization-slug": slug,
        ...(invitationId && { [INVITATION_ID_HEADER]: invitationId }),
      },
    });
    return result.user;
  }

  async function inviteToNewOrg(
    slug: string,
    opts: { role?: string; expiresAt?: Date } = {},
  ) {
    const organization = await createOrganization(slug);
    const { user: inviter } = await signUpAndGetSession(buildTestUser());
    const invitee = buildTestUser();
    const invitationId = await createInvitation(organization.id, inviter.id, {
      email: invitee.email,
      ...opts,
    });
    return { organization, invitee, invitationId };
  }

  async function getRole(userId: string, organizationId: string) {
    const [membership] = await db
      .select({ role: members.role })
      .from(members)
      .where(
        and(
          eq(members.userId, userId),
          eq(members.organizationId, organizationId),
        ),
      );
    return membership?.role;
  }

  it("signing up from the invitation joins with the invited role", async () => {
    const { organization, invitee, invitationId } = await inviteToNewOrg(
      "invited-org",
      { role: "admin" },
    );

    const user = await signUpOnHost("invited-org", invitee, invitationId);

    expect(await getRole(user.id, organization.id)).toBe("admin");
    expect(await getJoinRequests(user.id, organization.id)).toHaveLength(0);
  });

  it("signing up without the invitation link doesn't claim it", async () => {
    const { organization, invitee } = await inviteToNewOrg("unclaimed-org", {
      role: "admin",
    });

    const user = await signUpOnHost("unclaimed-org", invitee);

    expect(await getRole(user.id, organization.id)).toBeUndefined();
    expect(await getJoinRequests(user.id, organization.id)).toHaveLength(1);
  });

  it("files a join request instead when the invitation expired", async () => {
    const { organization, invitee, invitationId } = await inviteToNewOrg(
      "expired-invite-org",
      { role: "admin", expiresAt: new Date(Date.now() - HOUR_MS) },
    );

    const user = await signUpOnHost(
      "expired-invite-org",
      invitee,
      invitationId,
    );

    expect(await getRole(user.id, organization.id)).toBeUndefined();
    expect(await getJoinRequests(user.id, organization.id)).toHaveLength(1);
  });

  it("doesn't use another organization's invitation", async () => {
    const { invitee, invitationId } = await inviteToNewOrg("invite-host-a", {
      role: "admin",
    });
    const orgB = await createOrganization("invite-host-b");

    const user = await signUpOnHost("invite-host-b", invitee, invitationId);

    expect(await getRole(user.id, orgB.id)).toBeUndefined();
  });

  it("doesn't let someone else use the invitation link", async () => {
    const { organization, invitationId } = await inviteToNewOrg(
      "stolen-link-org",
      { role: "admin" },
    );

    const user = await signUpOnHost(
      "stolen-link-org",
      buildTestUser(),
      invitationId,
    );

    expect(await getRole(user.id, organization.id)).toBeUndefined();
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

describe("pages with no resolvable organization", () => {
  it.each([
    ["/", () => DashboardPage()],
    ["/events", () => EventsPage({ searchParams: Promise.resolve({}) })],
    ["/joinrequeststatus", () => JoinRequestStatusPage()],
  ] as const)(
    "%s reaches a terminal destination",
    async (_path, renderPage) => {
      const { headers } = await signUpAndGetSession(buildTestUser());
      mockHeaders.mockReturnValue(
        new Headers({ cookie: headers.Cookie, host: buildHost("missing") }),
      );
      await expect(renderPage()).rejects.toThrow(
        "NEXT_REDIRECT:/organization-not-found",
      );
    },
  );
});

describe("organization resolution regressions", () => {
  it("renders the terminal page without a session or redirect", () => {
    mockHeaders.mockReset();
    mockRedirect.mockClear();
    const markup = renderToStaticMarkup(OrganizationNotFoundPage());
    expect(markup).toContain("Check the spelling");
    expect(mockHeaders).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it.each([
    ["/", () => DashboardPage()],
    ["/events", () => EventsPage({ searchParams: Promise.resolve({}) })],
  ] as const)(
    "%s still admits members through the host fallback",
    async (_path, renderPage) => {
      const org = await createOrganization("member-org");
      const { user, headers } = await signUpAndGetSession(buildTestUser());
      await addMember(user.id, org.id, "member");
      mockHeaders.mockReturnValue(
        new Headers({ cookie: headers.Cookie, host: buildHost("member-org") }),
      );
      await expect(renderPage()).resolves.toBeDefined();
    },
  );

  it.each([
    ["/", () => DashboardPage()],
    ["/events", () => EventsPage({ searchParams: Promise.resolve({}) })],
  ] as const)(
    "%s still sends nonmembers to join request status",
    async (_path, renderPage) => {
      await createOrganization("nonmember-org");
      const { headers } = await signUpAndGetSession(buildTestUser());
      mockHeaders.mockReturnValue(
        new Headers({
          cookie: headers.Cookie,
          host: buildHost("nonmember-org"),
        }),
      );
      await expect(renderPage()).rejects.toThrow(
        "NEXT_REDIRECT:/joinrequeststatus",
      );
    },
  );
});
