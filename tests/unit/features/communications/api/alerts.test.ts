// @vitest-environment node
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import db from "@/core/db";
import {
  MemberType,
  NotificationType,
  notifications,
  OrganizationConfigKey,
} from "@/core/db/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import {
  addMember,
  buildTestUser,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
  testApi,
} from "@/tests/unit/testUtils";

async function addUser(
  organization: { id: string; slug: string },
  role: "owner" | "admin" | "member",
  memberType: MemberType | null = null,
) {
  const { user, session, headers } = await signUpAndGetSession(
    buildTestUser(),
    organization.slug,
  );
  await setActiveOrganization(session.id, organization.id);
  await addMember(user.id, organization.id, role, memberType);
  return { user, headers };
}

async function alertsFor(organizationId: string) {
  return db
    .select({
      userId: notifications.userId,
      organizationId: notifications.organizationId,
      type: notifications.type,
      text: notifications.text,
      read: notifications.read,
    })
    .from(notifications)
    .where(eq(notifications.organizationId, organizationId));
}

describe("POST /api/alerts", () => {
  it("returns 401 when signed out", async () => {
    const response = await testApi.alerts.$post({
      json: { title: "Weather", message: "Camp is closed." },
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-admin and creates nothing", async () => {
    const organization = await createOrganization("alerts-member");
    const { headers } = await addUser(organization, "member");

    const response = await testApi.alerts.$post(
      { json: { title: "Weather", message: "Camp is closed." } },
      { headers },
    );

    expect(response.status).toBe(403);
    expect(await alertsFor(organization.id)).toEqual([]);
  });

  it("sends an announcement to every member in the active organization", async () => {
    const organization = await createOrganization("alerts-all");
    const { headers } = await addUser(organization, "admin");
    const firstMember = await addUser(organization, "member");
    const secondMember = await addUser(organization, "member");

    const response = await testApi.alerts.$post(
      {
        json: {
          title: "  Weather update  ",
          message: "  Camp is closed today.  ",
        },
      },
      { headers },
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ sent: 3 });

    const created = await alertsFor(organization.id);
    expect(created).toHaveLength(3);
    expect(created.map(({ userId }) => userId)).toEqual(
      expect.arrayContaining([firstMember.user.id, secondMember.user.id]),
    );
    expect(
      created.every(({ organizationId }) => organizationId === organization.id),
    ).toBe(true);
    expect(
      created.every(({ type }) => type === NotificationType.Announcement),
    ).toBe(true);
    expect(
      created.every(
        ({ text }) => text === "Weather update\nCamp is closed today.",
      ),
    ).toBe(true);
    expect(created.every(({ read }) => read === false)).toBe(true);
  });

  it("targets only the requested member types when the feature is enabled", async () => {
    const organization = await createOrganization("alerts-types");
    const { headers } = await addUser(organization, "owner");
    const applicant = await addUser(
      organization,
      "member",
      MemberType.Applicant,
    );
    const attendee = await addUser(organization, "member", MemberType.Attendee);
    await OrganizationConfigService.setConfig(
      organization.id,
      OrganizationConfigKey.MemberTypesEnabled,
      "true",
    );

    const response = await testApi.alerts.$post(
      {
        json: {
          title: "Attendee update",
          message: "Bring your permission slip.",
          memberTypes: [MemberType.Attendee],
        },
      },
      { headers },
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ sent: 1 });
    expect(
      (await alertsFor(organization.id)).map(({ userId }) => userId),
    ).toEqual([attendee.user.id]);
    expect(
      (await alertsFor(organization.id)).some(
        ({ userId }) => userId === applicant.user.id,
      ),
    ).toBe(false);
  });

  it("ignores member-type targeting when member types are disabled", async () => {
    const organization = await createOrganization("alerts-types-off");
    const { headers } = await addUser(organization, "admin");
    await addUser(organization, "member", MemberType.Applicant);
    await addUser(organization, "member", MemberType.Attendee);

    const response = await testApi.alerts.$post(
      {
        json: {
          title: "Everyone update",
          message: "This goes to the whole organization.",
          memberTypes: [MemberType.Attendee],
        },
      },
      { headers },
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ sent: 3 });
    expect(await alertsFor(organization.id)).toHaveLength(3);
  });

  it("never sends an alert to another organization's members", async () => {
    const activeOrganization = await createOrganization("alerts-active");
    const otherOrganization = await createOrganization("alerts-other");
    const { headers } = await addUser(activeOrganization, "admin");
    await addUser(activeOrganization, "member");
    await addUser(otherOrganization, "member");

    const response = await testApi.alerts.$post(
      { json: { title: "Active org", message: "Only our members see this." } },
      { headers },
    );

    expect(response.status).toBe(201);
    expect(await alertsFor(activeOrganization.id)).toHaveLength(2);
    expect(await alertsFor(otherOrganization.id)).toEqual([]);
  });

  it.each([
    { title: "", message: "Message" },
    { title: "Title", message: "" },
    {
      title: "Title",
      message: "Message",
      memberTypes: ["camper" as MemberType],
    },
  ])("returns 400 for an invalid payload", async (json) => {
    const organization = await createOrganization(
      `alerts-invalid-${Math.random()}`,
    );
    const { headers } = await addUser(organization, "admin");

    const response = await testApi.alerts.$post({ json }, { headers });

    expect(response.status).toBe(400);
    expect(await alertsFor(organization.id)).toEqual([]);
  });
});
