// @vitest-environment node
import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { eventRsvps, members, MemberType, shiftRSVPs } from "@/lib/schema";
import {
  addMember,
  buildTestUser,
  createEvent,
  createEventRSVP,
  createOrganization,
  createShift,
  createShiftRSVP,
  setActiveOrganization,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";

describe("beforeRemoveMember hook", () => {
  it("deletes future event RSVPs for the removed member in that organization", async () => {
    const org = await createOrganization("hook-event-future");
    const adminUser = buildTestUser();
    const { session: adminSession, headers: adminHeaders } =
      await signUpAndGetSession(adminUser);
    await addMember(adminSession.userId, org.id, "admin");
    await setActiveOrganization(adminSession.id, org.id);

    const memberUser = buildTestUser();
    const { user: member } = await signUpAndGetSession(memberUser);
    await addMember(member.id, org.id, "member");

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const futureEventId = await createEvent(org.id, {
      startTimestamp: futureDate,
    });
    await createEventRSVP(futureEventId, member.id);

    await auth.api.removeMember({
      body: { memberIdOrEmail: member.email, organizationId: org.id },
      headers: adminHeaders,
    });

    const remaining = await db
      .select()
      .from(eventRsvps)
      .where(eq(eventRsvps.userId, member.id));

    expect(remaining).toHaveLength(0);
  });

  it("deletes future shift RSVPs for the removed member in that organization", async () => {
    const org = await createOrganization("hook-shift-future");
    const adminUser = buildTestUser();
    const { session: adminSession, headers: adminHeaders } =
      await signUpAndGetSession(adminUser);
    await addMember(adminSession.userId, org.id, "admin");
    await setActiveOrganization(adminSession.id, org.id);

    const memberUser = buildTestUser();
    const { user: member } = await signUpAndGetSession(memberUser);
    await addMember(member.id, org.id, "member");

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const futureShiftId = await createShift(org.id, {
      startTimestamp: futureDate,
    });
    await createShiftRSVP(futureShiftId, member.id);

    await auth.api.removeMember({
      body: { memberIdOrEmail: member.email, organizationId: org.id },
      headers: adminHeaders,
    });

    const remaining = await db
      .select()
      .from(shiftRSVPs)
      .where(eq(shiftRSVPs.userId, member.id));

    expect(remaining).toHaveLength(0);
  });

  it("preserves past event RSVPs after member removal", async () => {
    const org = await createOrganization("hook-past-event");
    const adminUser = buildTestUser();
    const { session: adminSession, headers: adminHeaders } =
      await signUpAndGetSession(adminUser);
    await addMember(adminSession.userId, org.id, "admin");
    await setActiveOrganization(adminSession.id, org.id);

    const memberUser = buildTestUser();
    const { user: member } = await signUpAndGetSession(memberUser);
    await addMember(member.id, org.id, "member");

    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const pastEventId = await createEvent(org.id, {
      startTimestamp: pastDate,
    });
    await createEventRSVP(pastEventId, member.id);

    await auth.api.removeMember({
      body: { memberIdOrEmail: member.email, organizationId: org.id },
      headers: adminHeaders,
    });

    const remaining = await db
      .select()
      .from(eventRsvps)
      .where(eq(eventRsvps.userId, member.id));

    expect(remaining).toHaveLength(1);
  });

  it("preserves past shift RSVPs after member removal", async () => {
    const org = await createOrganization("hook-past-shift");
    const adminUser = buildTestUser();
    const { session: adminSession, headers: adminHeaders } =
      await signUpAndGetSession(adminUser);
    await addMember(adminSession.userId, org.id, "admin");
    await setActiveOrganization(adminSession.id, org.id);

    const memberUser = buildTestUser();
    const { user: member } = await signUpAndGetSession(memberUser);
    await addMember(member.id, org.id, "member");

    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const pastShiftId = await createShift(org.id, { startTimestamp: pastDate });
    await createShiftRSVP(pastShiftId, member.id);

    await auth.api.removeMember({
      body: { memberIdOrEmail: member.email, organizationId: org.id },
      headers: adminHeaders,
    });

    const remaining = await db
      .select()
      .from(shiftRSVPs)
      .where(eq(shiftRSVPs.userId, member.id));

    expect(remaining).toHaveLength(1);
  });

  it("only deletes RSVPs from the organization being removed from, not other orgs", async () => {
    const org1 = await createOrganization("hook-iso-org1");
    const org2 = await createOrganization("hook-iso-org2");

    const adminUser = buildTestUser();
    const { session: adminSession, headers: adminHeaders } =
      await signUpAndGetSession(adminUser);
    await addMember(adminSession.userId, org1.id, "admin");
    await setActiveOrganization(adminSession.id, org1.id);

    const memberUser = buildTestUser();
    const { user: member } = await signUpAndGetSession(memberUser);
    await addMember(member.id, org1.id, "member");
    await addMember(member.id, org2.id, "member");

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const org1EventId = await createEvent(org1.id, {
      startTimestamp: futureDate,
    });
    await createEventRSVP(org1EventId, member.id);

    const org2EventId = await createEvent(org2.id, {
      startTimestamp: futureDate,
    });
    await createEventRSVP(org2EventId, member.id);

    await auth.api.removeMember({
      body: { memberIdOrEmail: member.email, organizationId: org1.id },
      headers: adminHeaders,
    });

    const remaining = await db
      .select()
      .from(eventRsvps)
      .where(eq(eventRsvps.userId, member.id));

    expect(remaining).toHaveLength(1);
    expect(remaining[0].eventId).toBe(org2EventId);
  });
});

describe("trusted origins", () => {
  // .env.test: BETTER_AUTH_URL=http://localhost:3000, E2E_TENANT_DOMAIN=lvh.me
  it("trusts the base URL and tenant subdomains", async () => {
    const context = await auth.$context;

    expect(context.isTrustedOrigin("http://localhost:3000")).toBe(true);
    expect(context.isTrustedOrigin("http://lvh.me:3000")).toBe(true);
    expect(context.isTrustedOrigin("http://acme.lvh.me:3000")).toBe(true);
    expect(context.isTrustedOrigin("http://vertical-icon.lvh.me:3000")).toBe(
      true,
    );
  });

  it("does not trust other sites, ports, or schemes", async () => {
    const context = await auth.$context;

    expect(context.isTrustedOrigin("http://evil.example")).toBe(false);
    expect(
      context.isTrustedOrigin("http://acme.lvh.me.evil.example:3000"),
    ).toBe(false);
    expect(context.isTrustedOrigin("http://evil-lvh.me:3000")).toBe(false);
    expect(context.isTrustedOrigin("http://acme.lvh.me:4000")).toBe(false);
    expect(context.isTrustedOrigin("https://acme.lvh.me")).toBe(false);
  });
});

describe("member type", () => {
  it("is returned with the member", async () => {
    const org = await createOrganization("member-type-read");
    const { session, headers } = await signUpAndGetSession(buildTestUser());
    await addMember(session.userId, org.id, "member");
    await setActiveOrganization(session.id, org.id);
    await db
      .update(members)
      .set({ memberType: MemberType.Applicant })
      .where(
        and(
          eq(members.userId, session.userId),
          eq(members.organizationId, org.id),
        ),
      );

    const member = await auth.api.getActiveMember({ headers });

    expect(member?.memberType).toBe(MemberType.Applicant);
  });

  it("can't be set through addMember's input", async () => {
    const org = await createOrganization("member-type-input");
    const { user } = await signUpAndGetSession(buildTestUser());

    // Not a literal, so TypeScript allows the field BetterAuth should drop.
    const body = {
      userId: user.id,
      organizationId: org.id,
      role: "member" as const,
      memberType: MemberType.Attendee,
    };
    await auth.api.addMember({ body });

    const [member] = await db
      .select()
      .from(members)
      .where(
        and(eq(members.userId, user.id), eq(members.organizationId, org.id)),
      );
    expect(member.memberType).toBeNull();
  });
});
