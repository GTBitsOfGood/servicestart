// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveDashboardLayout } from "@/app/settings/dashboard/actions";
import AdminDashboardSettingsPage from "@/app/settings/admindashboard/page";
import DashboardSettingsPage from "@/app/settings/dashboard/page";
import type { DashboardLayout } from "@/features/dashboard/lib/schema";
import { ForbiddenError } from "@/core/api/errors";
import { OrganizationConfigKey } from "@/core/db/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import type { MemberTypeKey } from "@/features/membership/lib/memberTypeKey";
import {
  addMember,
  buildHost,
  buildTestUser,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";

const mockHeaders = vi.fn();
vi.mock("next/headers", () => ({ headers: () => mockHeaders() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

const volunteer = "volunteer" as MemberTypeKey;
const staff = "staff" as MemberTypeKey;

const LAYOUT: DashboardLayout = {
  layout: "horizontal",
  widgets: [{ id: "newsletter", size: "tall" }],
};

const THREE_TYPES = {
  memberTypes: [
    { key: volunteer, label: "Volunteer", pluralLabel: "Volunteers" },
    { key: staff, label: "Staff", pluralLabel: "Staff" },
    { key: "board" as MemberTypeKey, label: "Board", pluralLabel: "Board" },
  ],
};

const getStored = async (orgId: string, key: OrganizationConfigKey) =>
  (await OrganizationConfigService.getConfig(orgId, [key]))[key];
const getMemberTypeLayouts = (orgId: string) =>
  getStored(orgId, OrganizationConfigKey.MemberTypeDashboardLayouts);

async function signInAs(
  role: string,
  orgOpts?: Parameters<typeof createOrganization>[1],
) {
  const org = await createOrganization(
    `dash-${Math.random().toString(36).slice(2, 10)}`,
    orgOpts,
  );
  const { user, session, headers } = await signUpAndGetSession(
    buildTestUser(),
    org.slug,
  );
  await addMember(user.id, org.id, role);
  await setActiveOrganization(session.id, org.id);
  mockHeaders.mockReturnValue(
    new Headers({ cookie: headers.Cookie, host: buildHost(org.slug) }),
  );
  return org;
}

describe("dashboard settings actions", () => {
  beforeEach(() => mockHeaders.mockReset());

  it("saves the member layout under its own key", async () => {
    const org = await signInAs("admin", THREE_TYPES);
    await saveDashboardLayout("member", LAYOUT);
    expect(
      await getStored(org.id, OrganizationConfigKey.DashboardLayout),
    ).toEqual(LAYOUT);
    expect(await getMemberTypeLayouts(org.id)).toEqual({});
  });

  it("saves a volunteer layout under its member type", async () => {
    const org = await signInAs("admin", THREE_TYPES);
    await saveDashboardLayout(volunteer, LAYOUT);
    expect(await getMemberTypeLayouts(org.id)).toEqual({
      [volunteer]: LAYOUT,
    });
  });

  it("drops a deleted type entry when saving another layout", async () => {
    const org = await signInAs("admin", THREE_TYPES);
    const retired = "retired" as MemberTypeKey;
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.MemberTypeDashboardLayouts,
      JSON.stringify({ [retired]: LAYOUT, [volunteer]: LAYOUT }),
    );
    await saveDashboardLayout(staff, {
      layout: "vertical",
      widgets: [],
    });
    expect(await getMemberTypeLayouts(org.id)).toEqual({
      [volunteer]: LAYOUT,
      [staff]: { layout: "vertical", widgets: [] },
    });
  });

  it("rejects an unknown audience", async () => {
    await signInAs("admin", THREE_TYPES);
    await expect(saveDashboardLayout("nobody", LAYOUT)).rejects.toThrow();
    await expect(saveDashboardLayout("attendee", LAYOUT)).rejects.toThrow();
  });

  it("rejects a non-admin member", async () => {
    const org = await signInAs("member", THREE_TYPES);
    await expect(saveDashboardLayout(volunteer, LAYOUT)).rejects.toThrow(
      ForbiddenError,
    );
    expect(await getMemberTypeLayouts(org.id)).toEqual({});
  });
});

describe("dashboard settings pages", () => {
  const settings = (audience?: string) => ({
    searchParams: Promise.resolve({ audience }),
  });

  it("only the member settings page turns on widget settings", async () => {
    await signInAs("admin", THREE_TYPES);
    expect((await AdminDashboardSettingsPage()).props.forms).toBeUndefined();
    expect((await DashboardSettingsPage(settings())).props.forms).toEqual([]);
  });

  it("ignores ?audience= while member types are off", async () => {
    const org = await signInAs("admin");
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.MemberTypesEnabled,
      "false",
    );
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.MemberTypeDashboardLayouts,
      JSON.stringify({ [volunteer]: LAYOUT }),
    );
    const page = await DashboardSettingsPage(settings(volunteer));
    expect(page.props.initialLayout).toEqual(
      await OrganizationConfigService.getDashboardLayout(org.id),
    );
  });

  it("falls back to Members for an unknown audience query", async () => {
    const org = await signInAs("admin", THREE_TYPES);
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.MemberTypesEnabled,
      "true",
    );
    const page = await DashboardSettingsPage(settings("attendee"));
    expect(page.props.initialLayout).toEqual(
      await OrganizationConfigService.getDashboardLayout(org.id),
    );
  });
});
