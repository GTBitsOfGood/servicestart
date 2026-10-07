// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MembersService } from "@/lib/services/MemberService";
import {
  buildHost,
  buildTestUser,
  createInvitation,
  createOrganization,
  signUpAndGetSession,
  testApi,
} from "@/tests/unit/testUtils";

const HOUR_MS = 60 * 60 * 1000;

function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

/** A signed-in user with an invitation to a new org on its own host. */
async function setup(opts: { role?: string; expiresAt?: Date } = {}) {
  const organization = await createOrganization(uniqueSlug("invitations-api"));
  const { user: inviter } = await signUpAndGetSession(buildTestUser());
  const { user, headers } = await signUpAndGetSession(buildTestUser());
  const invitationId = await createInvitation(organization.id, inviter.id, {
    email: user.email,
    ...opts,
  });
  return {
    organization,
    user,
    invitationId,
    headers: { ...headers, host: buildHost(organization.slug) },
  };
}

function accept(id: string, headers?: Record<string, string>) {
  return testApi.invitations[":id"].accept.$post(
    { param: { id } },
    { headers },
  );
}

describe("POST /api/invitations/:id/accept", () => {
  it("returns 401 when not logged in", async () => {
    const { invitationId, organization } = await setup();

    const response = await accept(invitationId, {
      host: buildHost(organization.slug),
    });

    expect(response.status).toBe(401);
  });

  it("adds the signed-in invitee with the invited role", async () => {
    const { organization, user, invitationId, headers } = await setup({
      role: "admin",
    });

    const response = await accept(invitationId, headers);

    expect(response.status).toBe(200);
    const membership = await MembersService.findByUserAndOrganization(
      user.id,
      organization.id,
    );
    expect(membership?.role).toBe("admin");
  });

  it("returns 403 for someone the invitation wasn't sent to", async () => {
    const { organization, invitationId } = await setup();
    const { headers } = await signUpAndGetSession(buildTestUser());

    const response = await accept(invitationId, {
      ...headers,
      host: buildHost(organization.slug),
    });

    expect(response.status).toBe(403);
  });

  it("returns 404 on another organization's host", async () => {
    const { invitationId, headers } = await setup();
    const otherOrg = await createOrganization(uniqueSlug("invitations-other"));

    const response = await accept(invitationId, {
      ...headers,
      host: buildHost(otherOrg.slug),
    });

    expect(response.status).toBe(404);
  });

  it("returns 410 for an expired invitation", async () => {
    const { invitationId, headers } = await setup({
      expiresAt: new Date(Date.now() - HOUR_MS),
    });

    const response = await accept(invitationId, headers);

    expect(response.status).toBe(410);
  });
});
