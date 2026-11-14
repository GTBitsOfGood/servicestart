// @vitest-environment node
import { describe, expect, it } from "vitest";
import getNavbarItems from "@/features/navigation/getNavbarItems";
import { NavbarConfigSchema } from "@/features/navigation/navbarConfig";
import type { NavbarConfig } from "@/features/navigation/navbarConfig";
import { OrganizationConfigKey } from "@/core/db/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import type { MemberTypeKey } from "@/features/membership/lib/memberTypeKey";
import {
  addMember,
  buildTestUser,
  createOrganization,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";

type Session = Parameters<typeof getNavbarItems>[0];

const volunteer = "volunteer" as MemberTypeKey;
const staff = "staff" as MemberTypeKey;

const CONFIG: NavbarConfig = {
  member: { labels: { "/inbox": "Messages" } },
  [volunteer]: { hidden: ["/events"], labels: { "/": "Volunteer Home" } },
  [staff]: { hidden: ["/inbox"], labels: { "/": "Staff Home" } },
  applicant: { hidden: ["/media"] },
};

async function setup({
  role = "member",
  memberType = null as MemberTypeKey | null,
  memberTypesEnabled = true,
  navbarConfig = CONFIG as NavbarConfig | null,
  orgMemberTypes,
}: {
  role?: string;
  memberType?: MemberTypeKey | null;
  memberTypesEnabled?: boolean;
  navbarConfig?: NavbarConfig | null;
  orgMemberTypes?: Parameters<typeof createOrganization>[1];
} = {}) {
  const org = await createOrganization(
    `nav-${Math.random().toString(36).slice(2, 10)}`,
    orgMemberTypes,
  );
  const { user } = await signUpAndGetSession(buildTestUser(), org.slug);
  await addMember(user.id, org.id, role, memberType);
  await OrganizationConfigService.setConfig(
    org.id,
    OrganizationConfigKey.MemberTypesEnabled,
    String(memberTypesEnabled),
  );
  if (navbarConfig) {
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.NavbarConfig,
      JSON.stringify(navbarConfig),
    );
  }
  return { org, user, session: { user, session: {} } as unknown as Session };
}

const view = (items: Awaited<ReturnType<typeof getNavbarItems>>) =>
  items.map(({ href, label, subpages }) => ({
    href,
    label,
    subpages: subpages?.map((s) => s.href),
  }));

describe("NavbarConfigSchema", () => {
  it("parses a pre-Sprint-5 row unchanged", () => {
    const config = { applicant: { hidden: ["/events"] } };
    expect(NavbarConfigSchema.parse(config)).toEqual(config);
  });
});

describe("getNavbarItems with NavbarConfig", () => {
  it("hides and renames items for a volunteer", async () => {
    const { org, session } = await setup({
      memberType: volunteer,
      orgMemberTypes: {
        memberTypes: [
          { key: volunteer, label: "Volunteer", pluralLabel: "Volunteers" },
          { key: staff, label: "Staff", pluralLabel: "Staff" },
        ],
      },
    });
    expect(view(await getNavbarItems(session, org.id))).toEqual([
      { href: "/", label: "Volunteer Home", subpages: undefined },
      { href: "/inbox", label: "Inbox", subpages: undefined },
    ]);
  });

  it("hides and renames items for staff", async () => {
    const { org, session } = await setup({
      memberType: staff,
      orgMemberTypes: {
        memberTypes: [
          { key: volunteer, label: "Volunteer", pluralLabel: "Volunteers" },
          { key: staff, label: "Staff", pluralLabel: "Staff" },
        ],
      },
    });
    expect(view(await getNavbarItems(session, org.id))).toEqual([
      { href: "/", label: "Staff Home", subpages: undefined },
      { href: "/events", label: "Events", subpages: undefined },
    ]);
  });

  it("uses the member entry when member types are off", async () => {
    const { org, session } = await setup({
      memberType: volunteer,
      memberTypesEnabled: false,
      orgMemberTypes: {
        memberTypes: [
          { key: volunteer, label: "Volunteer", pluralLabel: "Volunteers" },
        ],
      },
    });
    expect(view(await getNavbarItems(session, org.id))).toEqual([
      { href: "/", label: "Home", subpages: undefined },
      { href: "/inbox", label: "Messages", subpages: undefined },
      { href: "/events", label: "Events", subpages: undefined },
    ]);
  });

  it("ignores navbar config for a deleted type key", async () => {
    const { org, session } = await setup({
      memberType: volunteer,
      orgMemberTypes: {
        memberTypes: [
          { key: volunteer, label: "Volunteer", pluralLabel: "Volunteers" },
        ],
      },
    });
    expect(view(await getNavbarItems(session, org.id))).toEqual([
      { href: "/", label: "Volunteer Home", subpages: undefined },
      { href: "/inbox", label: "Inbox", subpages: undefined },
    ]);
  });

  it("matches today's navbar when there is no config row", async () => {
    const { org, session } = await setup({
      memberType: volunteer,
      navbarConfig: null,
      orgMemberTypes: {
        memberTypes: [
          { key: volunteer, label: "Volunteer", pluralLabel: "Volunteers" },
        ],
      },
    });
    expect(view(await getNavbarItems(session, org.id))).toEqual([
      { href: "/", label: "Home", subpages: undefined },
      { href: "/inbox", label: "Inbox", subpages: undefined },
      { href: "/events", label: "Events", subpages: undefined },
    ]);
  });

  it.each(["admin", "owner"])(
    "gives an %s the full navbar whatever the config",
    async (role) => {
      const hideAll: NavbarConfig = {
        member: {
          hidden: ["/", "/media", "/settings/dashboard"],
          labels: { "/inbox": "Messages" },
        },
      };
      const withConfig = await setup({
        role,
        navbarConfig: hideAll,
        orgMemberTypes: { memberTypes: [] },
      });
      const without = await setup({
        role,
        navbarConfig: null,
        orgMemberTypes: { memberTypes: [] },
      });
      const items = view(
        await getNavbarItems(withConfig.session, withConfig.org.id),
      );
      expect(items).toEqual(
        view(await getNavbarItems(without.session, without.org.id)),
      );
      expect(items.map((i) => i.label)).toContain("Media Library");
    },
  );

  it("doesn't apply the member entry to signed-out visitors", async () => {
    const { org } = await setup({ orgMemberTypes: { memberTypes: [] } });
    expect(view(await getNavbarItems(null, org.id))).toEqual([
      { href: "/", label: "Home", subpages: undefined },
      { href: "/inbox", label: "Inbox", subpages: undefined },
      { href: "/events", label: "Events", subpages: undefined },
    ]);
  });
});
