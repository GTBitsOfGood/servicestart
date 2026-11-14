// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { OrganizationConfigKey } from "@/core/db/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import { getDashboardAudience } from "@/features/membership/lib/audience";
import { MemberTypeKeySchema } from "@/features/membership/lib/memberTypeKey";
import getNavbarItems from "@/features/navigation/getNavbarItems";
import { resolveDashboardHeader } from "@/features/dashboard/lib/header";
import { setMemberTypeDashboardLayout } from "@/features/dashboard/server";
import type { DashboardLayout } from "@/features/dashboard/lib/schema";
import type { NavbarConfig } from "@/features/navigation/navbarConfig";
import { MembersService } from "@/features/membership/services/MemberService";
import {
  addMember,
  buildTestUser,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
  testApi,
} from "@/tests/unit/testUtils";

const volunteer = MemberTypeKeySchema.parse("volunteer");
const staff = MemberTypeKeySchema.parse("staff");

const staffLayout: DashboardLayout = {
  layout: "horizontal",
  widgets: [{ id: "notifications", size: "tall" }],
};

const staffNavbar: NavbarConfig = {
  [staff]: { labels: { "/": "Staff home" } },
};

describe("generic org-defined member types", () => {
  it("resolves staff audience, layout, navbar, and header after admin retargets", async () => {
    const org = await createOrganization(`generic-${randomUUID()}`, {
      memberTypes: [
        {
          key: volunteer,
          label: "Volunteer",
          pluralLabel: "Volunteers",
          isSignupDefault: true,
        },
        {
          key: staff,
          label: "Staff",
          pluralLabel: "Staff",
        },
      ],
    });
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.MemberTypesEnabled,
      "true",
    );
    await setMemberTypeDashboardLayout(org.id, staff, staffLayout);
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.DashboardHeader,
      JSON.stringify({ [staff]: { title: "Staff HQ" } }),
    );
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.NavbarConfig,
      JSON.stringify(staffNavbar),
    );

    const signup = await signUpAndGetSession(buildTestUser(), org.slug);
    await MembersService.addSignupMember(signup.user.id, org.id);
    let membership = await MembersService.findByUserAndOrganization(
      signup.user.id,
      org.id,
    );
    expect(membership?.memberType).toBe(volunteer);

    const adminSession = await signUpAndGetSession(buildTestUser(), org.slug);
    await addMember(adminSession.user.id, org.id, "admin");
    await setActiveOrganization(adminSession.session.id, org.id);
    const patch = await testApi.members.type.$patch(
      { json: { userIds: [signup.user.id], memberType: staff } },
      { headers: adminSession.headers },
    );
    expect(patch.status).toBe(200);

    membership = await MembersService.findByUserAndOrganization(
      signup.user.id,
      org.id,
    );
    expect(membership?.memberType).toBe(staff);
    expect(getDashboardAudience(membership, true)).toBe(staff);

    const layout = await OrganizationConfigService.getDashboardLayoutFor(
      org.id,
      staff,
    );
    expect(layout).toEqual(staffLayout);

    const header = await OrganizationConfigService.getDashboardHeader(org.id);
    expect(resolveDashboardHeader(header, staff, signup.user.name).title).toBe(
      "Staff HQ",
    );

    const nav = await getNavbarItems(
      { user: signup.user, session: {} } as Parameters<
        typeof getNavbarItems
      >[0],
      org.id,
    );
    expect(nav.find((item) => item.href === "/")?.label).toBe("Staff home");
  });

  it("resolves volunteer, staff, and board header, navbar, and layouts", async () => {
    const board = MemberTypeKeySchema.parse("board");
    const org = await createOrganization(`generic-three-${randomUUID()}`, {
      memberTypes: [
        {
          key: volunteer,
          label: "Volunteer",
          pluralLabel: "Volunteers",
          isSignupDefault: true,
        },
        { key: staff, label: "Staff", pluralLabel: "Staff" },
        { key: board, label: "Board", pluralLabel: "Board" },
      ],
    });
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.MemberTypesEnabled,
      "true",
    );
    const boardLayout: DashboardLayout = {
      layout: "horizontal",
      widgets: [{ id: "notifications", size: "small" }],
    };
    await setMemberTypeDashboardLayout(org.id, board, boardLayout);
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.DashboardHeader,
      JSON.stringify({
        [volunteer]: { title: "Volunteers" },
        [staff]: { title: "Staff" },
        [board]: { title: "Board" },
      }),
    );
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.NavbarConfig,
      JSON.stringify({
        [volunteer]: { labels: { "/": "Volunteer home" } },
        [staff]: { labels: { "/": "Staff home" } },
        [board]: { labels: { "/": "Board home" } },
      }),
    );

    const volunteerMember = await signUpAndGetSession(
      buildTestUser(),
      org.slug,
    );
    await addMember(volunteerMember.user.id, org.id, "member", volunteer);
    const staffMember = await signUpAndGetSession(buildTestUser(), org.slug);
    await addMember(staffMember.user.id, org.id, "member", staff);
    const boardMember = await signUpAndGetSession(buildTestUser(), org.slug);
    await addMember(boardMember.user.id, org.id, "member", board);

    for (const [session, audience, homeLabel, title] of [
      [volunteerMember, volunteer, "Volunteer home", "Volunteers"],
      [staffMember, staff, "Staff home", "Staff"],
      [boardMember, board, "Board home", "Board"],
    ] as const) {
      const membership = await MembersService.findByUserAndOrganization(
        session.user.id,
        org.id,
      );
      expect(getDashboardAudience(membership, true)).toBe(audience);
      const layout = await OrganizationConfigService.getDashboardLayoutFor(
        org.id,
        audience,
      );
      expect(layout).toEqual(
        audience === board
          ? boardLayout
          : await OrganizationConfigService.getDashboardLayout(org.id),
      );
      const header = await OrganizationConfigService.getDashboardHeader(org.id);
      expect(
        resolveDashboardHeader(header, audience, session.user.name).title,
      ).toBe(title);
      const nav = await getNavbarItems(
        { user: session.user, session: {} } as Parameters<
          typeof getNavbarItems
        >[0],
        org.id,
      );
      expect(nav.find((item) => item.href === "/")?.label).toBe(homeLabel);
    }
  });

  it("falls back to member audience with no configured types", async () => {
    const org = await createOrganization(`generic-none-${randomUUID()}`, {
      memberTypes: [],
    });
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.MemberTypesEnabled,
      "true",
    );
    const { user } = await signUpAndGetSession(buildTestUser(), org.slug);
    await addMember(user.id, org.id, "member", null);
    const membership = await MembersService.findByUserAndOrganization(
      user.id,
      org.id,
    );
    expect(getDashboardAudience(membership, true)).toBe("member");
    const header = await OrganizationConfigService.getDashboardHeader(org.id);
    expect(
      resolveDashboardHeader(header, "member", user.name).title.length,
    ).toBeGreaterThan(0);
    const nav = await getNavbarItems(
      { user, session: {} } as Parameters<typeof getNavbarItems>[0],
      org.id,
    );
    expect(nav.length).toBeGreaterThan(0);
  });

  it("uses the member audience when types are off and hides memberTypes API", async () => {
    const org = await createOrganization(`generic-off-${randomUUID()}`, {
      memberTypes: [
        {
          key: volunteer,
          label: "Volunteer",
          pluralLabel: "Volunteers",
          isSignupDefault: true,
        },
        { key: staff, label: "Staff", pluralLabel: "Staff" },
      ],
    });
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.MemberTypesEnabled,
      "true",
    );
    const memberSession = await signUpAndGetSession(buildTestUser(), org.slug);
    await addMember(memberSession.user.id, org.id, "member", staff);
    await setActiveOrganization(memberSession.session.id, org.id);
    const adminSession = await signUpAndGetSession(buildTestUser(), org.slug);
    await addMember(adminSession.user.id, org.id, "admin");
    await setActiveOrganization(adminSession.session.id, org.id);
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.MemberTypesEnabled,
      "false",
    );

    const membership = await MembersService.findByUserAndOrganization(
      memberSession.user.id,
      org.id,
    );
    expect(getDashboardAudience(membership, false)).toBe("member");
    const response = await testApi.memberTypes.$get(
      {},
      { headers: adminSession.headers },
    );
    expect(response.status).toBe(404);
  });
});
