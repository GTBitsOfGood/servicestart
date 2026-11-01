// @vitest-environment node
import { describe, expect, it } from "vitest";
import getNavbarItems from "@/lib/getNavbarItems";
import type { NavbarConfig } from "@/lib/navbar";
import { MemberType, OrganizationConfigKey } from "@/lib/schema";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import {
  addMember,
  buildTestUser,
  createOrganization,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";

type Session = Parameters<typeof getNavbarItems>[0];

const CONFIG: NavbarConfig = {
  member: { labels: { "/inbox": "Messages" } },
  applicant: { hidden: ["/events"], labels: { "/": "My Application" } },
  attendee: { labels: { "/": "My Camp" } },
};

async function setup({
  role = "member",
  memberType = null as MemberType | null,
  memberTypesEnabled = true,
  navbarConfig = CONFIG as NavbarConfig | null,
} = {}) {
  const org = await createOrganization(
    `nav-${Math.random().toString(36).slice(2, 10)}`,
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

describe("getNavbarItems with NavbarConfig", () => {
  it("hides and renames items for an applicant", async () => {
    const { org, session } = await setup({ memberType: MemberType.Applicant });
    expect(view(await getNavbarItems(session, org.id))).toEqual([
      { href: "/", label: "My Application", subpages: undefined },
      { href: "/inbox", label: "Inbox", subpages: undefined },
    ]);
  });

  it("renames items for an attendee", async () => {
    const { org, session } = await setup({ memberType: MemberType.Attendee });
    expect(view(await getNavbarItems(session, org.id))).toEqual([
      { href: "/", label: "My Camp", subpages: undefined },
      { href: "/inbox", label: "Inbox", subpages: undefined },
      { href: "/events", label: "Events", subpages: undefined },
    ]);
  });

  it("uses the member entry for a typed member when member types are off", async () => {
    const { org, session } = await setup({
      memberType: MemberType.Applicant,
      memberTypesEnabled: false,
    });
    expect(view(await getNavbarItems(session, org.id))).toEqual([
      { href: "/", label: "Home", subpages: undefined },
      { href: "/inbox", label: "Messages", subpages: undefined },
      { href: "/events", label: "Events", subpages: undefined },
    ]);
  });

  it("matches today's navbar when there is no config row", async () => {
    const { org, session } = await setup({
      memberType: MemberType.Applicant,
      navbarConfig: null,
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
      const withConfig = await setup({ role, navbarConfig: hideAll });
      const without = await setup({ role, navbarConfig: null });
      const items = view(
        await getNavbarItems(withConfig.session, withConfig.org.id),
      );
      expect(items).toEqual(
        view(await getNavbarItems(without.session, without.org.id)),
      );
      expect(items.map((i) => i.label)).toContain("Media Library");
      expect(items.find((i) => i.href === "/settings")?.subpages).toContain(
        "/settings/dashboard",
      );
    },
  );

  it("drops hidden hrefs from subpages as well as top-level items", async () => {
    // Only admins see subpages today, so check the filter through a member
    // whose config hides a subpage href alongside a top-level one: neither
    // may appear anywhere in the output.
    const { org, session } = await setup({
      navbarConfig: { member: { hidden: ["/settings/dashboard", "/inbox"] } },
    });
    const items = await getNavbarItems(session, org.id);
    const hrefs = items.flatMap((i) => [
      i.href,
      ...(i.subpages ?? []).map((s) => s.href),
    ]);
    expect(hrefs).not.toContain("/inbox");
    expect(hrefs).not.toContain("/settings/dashboard");
  });

  it("ignores another org's config", async () => {
    // The same applicant belongs to org A (with a config row) and org B
    // (without one); in B they get B's unchanged navbar.
    const a = await setup({ memberType: MemberType.Applicant });
    const b = await createOrganization(`nav-b-${Date.now()}`);
    await addMember(a.user.id, b.id, "member", MemberType.Applicant);
    await OrganizationConfigService.setConfig(
      b.id,
      OrganizationConfigKey.MemberTypesEnabled,
      "true",
    );
    expect(view(await getNavbarItems(a.session, b.id))).toEqual([
      { href: "/", label: "Home", subpages: undefined },
      { href: "/inbox", label: "Inbox", subpages: undefined },
      { href: "/events", label: "Events", subpages: undefined },
    ]);
  });
});
