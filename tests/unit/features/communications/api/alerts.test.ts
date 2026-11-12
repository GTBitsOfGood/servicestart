// @vitest-environment node
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import db from "@/core/db";
import { notifications, OrganizationConfigKey } from "@/core/db/schema";
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

  it("accepts three recipient types", async () => {
    const organization = await createOrganization("alerts-three", ORG_TYPES);
    const { headers } = await addUser(organization, "owner");
    await addUser(organization, "member", volunteer);
    await addUser(organization, "member", staff);
    await addUser(organization, "member", board);
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

  it("returns 400 for an invalid payload", async () => {
    const organization = await createOrganization(
      `alerts-invalid-${Math.random()}`,
    );
    const { headers } = await addUser(organization, "admin");

    const response = await testApi.alerts.$post(
      { json: { title: "", message: "Message" } },
      { headers },
    );

    expect(response.status).toBe(400);
  });
});
