// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDashboardLayout,
  saveDashboardLayout,
} from "@/app/settings/dashboard/actions";
import AdminDashboardSettingsPage from "@/app/settings/admindashboard/page";
import DashboardSettingsPage from "@/app/settings/dashboard/page";
import type { DashboardLayout } from "@/features/dashboard/lib/schema";
import { ForbiddenError } from "@/core/api/errors";
import { OrganizationConfigKey } from "@/core/db/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
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

const LAYOUT: DashboardLayout = {
  layout: "horizontal",
  widgets: [{ id: "newsletter", size: "tall" }],
};

const getStored = async (orgId: string, key: OrganizationConfigKey) =>
  (await OrganizationConfigService.getConfig(orgId, [key]))[key];

async function signInAs(role: string) {
  const org = await createOrganization(
    `dash-${Math.random().toString(36).slice(2, 10)}`,
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

  it.each([
    ["member", OrganizationConfigKey.DashboardLayout],
    ["applicant", OrganizationConfigKey.ApplicantDashboardLayout],
    ["attendee", OrganizationConfigKey.AttendeeDashboardLayout],
  ] as const)(
    "saves the %s layout under its own key",
    async (audience, key) => {
      const org = await signInAs("admin");
      await saveDashboardLayout(audience, LAYOUT);
      expect(await getStored(org.id, key)).toEqual(LAYOUT);
      // The other audiences' own layouts are untouched.
      const others = [
        OrganizationConfigKey.ApplicantDashboardLayout,
        OrganizationConfigKey.AttendeeDashboardLayout,
      ].filter((other) => other !== key);
      for (const other of others) {
        expect(await getStored(org.id, other)).toBeNull();
      }
    },
  );

  it.each(["applicant", "attendee"] as const)(
    "clears the %s layout so the member layout applies",
    async (audience) => {
      const org = await signInAs("owner");
      await saveDashboardLayout(audience, LAYOUT);
      await clearDashboardLayout(audience);
      expect(
        await OrganizationConfigService.getDashboardLayoutFor(org.id, audience),
      ).toEqual(await OrganizationConfigService.getDashboardLayout(org.id));
    },
  );

  it("won't clear the member layout or an unknown audience", async () => {
    await signInAs("admin");
    await expect(clearDashboardLayout("member")).rejects.toThrow();
    await expect(clearDashboardLayout("admin")).rejects.toThrow();
    await expect(saveDashboardLayout("admin", LAYOUT)).rejects.toThrow();
    await expect(saveDashboardLayout("nobody", LAYOUT)).rejects.toThrow();
  });

  it("rejects a non-admin member", async () => {
    const org = await signInAs("member");
    await expect(saveDashboardLayout("applicant", LAYOUT)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(clearDashboardLayout("applicant")).rejects.toThrow(
      ForbiddenError,
    );
    expect(
      await getStored(org.id, OrganizationConfigKey.ApplicantDashboardLayout),
    ).toBeNull();
  });

  it("rejects widget settings that fail their schema", async () => {
    const org = await signInAs("admin");
    const bad = {
      layout: "horizontal",
      widgets: [
        {
          id: "application_status",
          size: "tall",
          config: { formId: "camp", steps: [{ label: "", description: "" }] },
        },
      ],
    } as DashboardLayout;
    await expect(saveDashboardLayout("applicant", bad)).rejects.toThrow();
    await expect(saveDashboardLayout("member", bad)).rejects.toThrow();
    expect(
      await getStored(org.id, OrganizationConfigKey.ApplicantDashboardLayout),
    ).toBeNull();
  });
});

describe("dashboard settings pages", () => {
  const settings = (audience?: string) => ({
    searchParams: Promise.resolve({ audience }),
  });

  it("only the member settings page turns on widget settings", async () => {
    await signInAs("admin");
    expect((await AdminDashboardSettingsPage()).props.forms).toBeUndefined();
    expect((await DashboardSettingsPage(settings())).props.forms).toEqual([]);
  });

  it("ignores ?audience= while member types are off", async () => {
    const org = await signInAs("admin");
    await saveDashboardLayout("applicant", LAYOUT);
    const page = await DashboardSettingsPage(settings("applicant"));
    expect(page.props.initialLayout).toEqual(
      await OrganizationConfigService.getDashboardLayout(org.id),
    );
  });

  it("starts an audience without its own layout from the member layout", async () => {
    const org = await signInAs("admin");
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.MemberTypesEnabled,
      "true",
    );
    const fallback = await DashboardSettingsPage(settings("attendee"));
    expect(fallback.props.initialLayout).toEqual(
      await OrganizationConfigService.getDashboardLayout(org.id),
    );
    await saveDashboardLayout("attendee", LAYOUT);
    const own = await DashboardSettingsPage(settings("attendee"));
    expect(own.props.initialLayout).toEqual(LAYOUT);
    expect(own.key).not.toBe(fallback.key);
  });
});
