// @vitest-environment node
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import db from "@/lib/db";
import { invitations } from "@/lib/schema";
import {
  InvitationService,
  InvitationStatus,
} from "@/lib/services/InvitationService";
import { MembersService } from "@/lib/services/MemberService";
import {
  addMember,
  buildTestUser,
  createInvitation,
  createOrganization,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";

const HOUR_MS = 60 * 60 * 1000;

async function setup(slug: string) {
  const organization = await createOrganization(slug);
  const { user: inviter } = await signUpAndGetSession(buildTestUser());
  return { organization, inviter };
}

async function getStatus(invitationId: string) {
  const [row] = await db
    .select({ status: invitations.status })
    .from(invitations)
    .where(eq(invitations.id, invitationId));
  return row?.status;
}

describe("InvitationService.findByIdAndOrganization", () => {
  it("returns the invitation with its organization's name", async () => {
    const { organization, inviter } = await setup("invite-find");
    const id = await createInvitation(organization.id, inviter.id, {
      email: "staff@example.com",
      role: "admin",
    });

    const invitation = await InvitationService.findByIdAndOrganization(
      id,
      organization.id,
    );

    expect(invitation).toMatchObject({
      id,
      email: "staff@example.com",
      role: "admin",
      status: InvitationStatus.Pending,
      organizationName: "Organization invite-find",
    });
  });

  it("returns null for another organization's invitation", async () => {
    const { organization: orgA, inviter } = await setup("invite-org-a");
    const orgB = await createOrganization("invite-org-b");
    const id = await createInvitation(orgA.id, inviter.id);

    expect(
      await InvitationService.findByIdAndOrganization(id, orgB.id),
    ).toBeNull();
  });

  it("returns null for an unknown id", async () => {
    const { organization } = await setup("invite-unknown");

    expect(
      await InvitationService.findByIdAndOrganization(
        "no-such-invitation",
        organization.id,
      ),
    ).toBeNull();
  });
});

describe("InvitationService.isOpen", () => {
  const now = new Date();
  const future = new Date(now.getTime() + HOUR_MS);
  const past = new Date(now.getTime() - HOUR_MS);

  it("is open while pending and unexpired", () => {
    expect(
      InvitationService.isOpen(
        { status: InvitationStatus.Pending, expiresAt: future },
        now,
      ),
    ).toBe(true);
  });

  it("is closed once expired", () => {
    expect(
      InvitationService.isOpen(
        { status: InvitationStatus.Pending, expiresAt: past },
        now,
      ),
    ).toBe(false);
  });

  it.each([
    InvitationStatus.Accepted,
    InvitationStatus.Rejected,
    InvitationStatus.Canceled,
  ])("is closed when %s", (status) => {
    expect(InvitationService.isOpen({ status, expiresAt: future }, now)).toBe(
      false,
    );
  });
});

describe("InvitationService.acceptForUser", () => {
  async function setupInvitee(slug: string, opts = {}) {
    const { organization, inviter } = await setup(slug);
    const { user } = await signUpAndGetSession(buildTestUser());
    const id = await createInvitation(organization.id, inviter.id, {
      email: user.email,
      ...opts,
    });
    return { organization, user, id };
  }

  it("adds the invitee with the invited role and marks the invitation accepted", async () => {
    const { organization, user, id } = await setupInvitee("invite-accept", {
      role: "admin",
    });

    const role = await InvitationService.acceptForUser(id, organization.id, {
      id: user.id,
      email: user.email.toUpperCase(),
    });

    expect(role).toBe("admin");
    expect(await getStatus(id)).toBe(InvitationStatus.Accepted);
    const membership = await MembersService.findByUserAndOrganization(
      user.id,
      organization.id,
    );
    expect(membership?.role).toBe("admin");
  });

  it("accepts an invitation only once", async () => {
    const { organization, user, id } = await setupInvitee("invite-once");
    await InvitationService.acceptForUser(id, organization.id, user);

    expect(
      await InvitationService.acceptForUser(id, organization.id, user),
    ).toBe(undefined);
  });

  it("rejects an expired invitation", async () => {
    const { organization, user, id } = await setupInvitee("invite-expired", {
      expiresAt: new Date(Date.now() - HOUR_MS),
    });

    expect(
      await InvitationService.acceptForUser(id, organization.id, user),
    ).toBe(undefined);
    expect(await getStatus(id)).toBe(InvitationStatus.Pending);
    expect(
      await MembersService.findByUserAndOrganization(user.id, organization.id),
    ).toBeNull();
  });

  it("rejects a canceled invitation", async () => {
    const { organization, user, id } = await setupInvitee("invite-canceled", {
      status: InvitationStatus.Canceled,
    });

    expect(
      await InvitationService.acceptForUser(id, organization.id, user),
    ).toBe(undefined);
  });

  it("rejects someone the invitation wasn't sent to", async () => {
    const { organization, id } = await setupInvitee("invite-recipient");
    const { user: someoneElse } = await signUpAndGetSession(buildTestUser());

    expect(
      await InvitationService.acceptForUser(id, organization.id, someoneElse),
    ).toBe(undefined);
    expect(await getStatus(id)).toBe(InvitationStatus.Pending);
  });

  it("doesn't add an existing member twice", async () => {
    const { organization, user, id } = await setupInvitee("invite-member");
    await addMember(user.id, organization.id, "member");

    expect(
      await InvitationService.acceptForUser(id, organization.id, user),
    ).toBe(undefined);
    expect(await getStatus(id)).toBe(InvitationStatus.Pending);
  });

  it("doesn't accept another organization's invitation", async () => {
    const { user, id } = await setupInvitee("invite-scope-a");
    const orgB = await createOrganization("invite-scope-b");

    expect(await InvitationService.acceptForUser(id, orgB.id, user)).toBe(
      undefined,
    );
    expect(await getStatus(id)).toBe(InvitationStatus.Pending);
    expect(
      await MembersService.findByUserAndOrganization(user.id, orgB.id),
    ).toBeNull();
  });
});
