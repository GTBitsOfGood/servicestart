// @vitest-environment node
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import db from "@/core/db";
import {
  NotificationType,
  notifications,
  OrganizationConfigKey,
} from "@/core/db/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import { PostDashboardAlertSchema } from "@/features/communications/lib/alerts";
import type { MemberTypeKey } from "@/features/membership/lib/memberTypeKey";
import {
  addMember,
  buildTestUser,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
  testApi,
} from "@/tests/unit/testUtils";

const volunteer = "volunteer" as MemberTypeKey;
const staff = "staff" as MemberTypeKey;
const board = "board" as MemberTypeKey;

const ORG_TYPES = {
  memberTypes: [
    { key: volunteer, label: "Volunteer", pluralLabel: "Volunteers" },
    { key: staff, label: "Staff", pluralLabel: "Staff" },
    { key: board, label: "Board", pluralLabel: "Board" },
  ],
};

async function addUser(
  organization: { id: string; slug: string },
  role: "owner" | "admin" | "member",
  memberType: MemberTypeKey | null = null,
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

describe("PostDashboardAlertSchema", () => {
  it('still parses ["applicant"] from before Sprint 5', () => {
    expect(
      PostDashboardAlertSchema.parse({
        title: "Hello",
        message: "World",
        memberTypes: ["applicant"],
      }).memberTypes,
    ).toEqual(["applicant"]);
  });
});

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
    const admin = await addUser(organization, "admin");
    const firstMember = await addUser(organization, "member");
    const secondMember = await addUser(organization, "member");

    const response = await testApi.alerts.$post(
      {
        json: {
          title: "  Weather update  ",
          message: "  Camp is closed today.  ",
        },
      },
      { headers: admin.headers },
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ sent: 3 });
    const created = await alertsFor(organization.id);
    expect(created.map(({ userId }) => userId).sort()).toEqual(
      [admin.user.id, firstMember.user.id, secondMember.user.id].sort(),
    );
    expect(
      created.every(
        ({ type, text, read }) =>
          type === NotificationType.Announcement &&
          text === "Weather update\nCamp is closed today." &&
          read === false,
      ),
    ).toBe(true);
  });

  it("sends only to members of the requested org-defined types", async () => {
    const organization = await createOrganization("alerts-three", ORG_TYPES);
    const { headers } = await addUser(organization, "owner");
    const volunteerMember = await addUser(organization, "member", volunteer);
    const staffMember = await addUser(organization, "member", staff);
    const boardMember = await addUser(organization, "member", board);
    await addUser(organization, "member");
    await OrganizationConfigService.setConfig(
      organization.id,
      OrganizationConfigKey.MemberTypesEnabled,
      "true",
    );

    const response = await testApi.alerts.$post(
      {
        json: {
          title: "Update",
          message: "Please read this.",
          memberTypes: [volunteer, staff, board],
        },
      },
      { headers },
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ sent: 3 });
    expect(
      (await alertsFor(organization.id)).map(({ userId }) => userId).sort(),
    ).toEqual(
      [
        volunteerMember.user.id,
        staffMember.user.id,
        boardMember.user.id,
      ].sort(),
    );
  });

  it("ignores member-type targeting when member types are disabled", async () => {
    const organization = await createOrganization(
      "alerts-types-off",
      ORG_TYPES,
    );
    const { headers } = await addUser(organization, "admin");
    await addUser(organization, "member", volunteer);
    await addUser(organization, "member", staff);

    const response = await testApi.alerts.$post(
      {
        json: {
          title: "Everyone update",
          message: "This goes to the whole organization.",
          memberTypes: [staff],
        },
      },
      { headers },
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ sent: 3 });
    expect(await alertsFor(organization.id)).toHaveLength(3);
  });

  it("never sends an alert to another organization's members", async () => {
    const activeOrganization = await createOrganization(
      "alerts-active",
      ORG_TYPES,
    );
    const otherOrganization = await createOrganization(
      "alerts-other",
      ORG_TYPES,
    );
    const { headers } = await addUser(activeOrganization, "admin");
    await addUser(activeOrganization, "member", volunteer);
    await addUser(otherOrganization, "member", volunteer);
    await OrganizationConfigService.setConfig(
      activeOrganization.id,
      OrganizationConfigKey.MemberTypesEnabled,
      "true",
    );

    const response = await testApi.alerts.$post(
      {
        json: {
          title: "Active org",
          message: "Only our volunteers see this.",
          memberTypes: [volunteer],
        },
      },
      { headers },
    );

    expect(response.status).toBe(201);
    expect(await alertsFor(activeOrganization.id)).toHaveLength(1);
    expect(await alertsFor(otherOrganization.id)).toEqual([]);
  });

  it("returns 400 for an unknown member type key", async () => {
    const organization = await createOrganization("alerts-unknown", ORG_TYPES);
    const { headers } = await addUser(organization, "admin");
    await OrganizationConfigService.setConfig(
      organization.id,
      OrganizationConfigKey.MemberTypesEnabled,
      "true",
    );

    const response = await testApi.alerts.$post(
      {
        json: {
          title: "Title",
          message: "Message",
          memberTypes: ["attendee"],
        },
      },
      { headers },
    );

    expect(response.status).toBe(400);
    expect(await alertsFor(organization.id)).toEqual([]);
  });

  it.each([
    { title: "", message: "Message" },
    { title: "Title", message: "" },
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
