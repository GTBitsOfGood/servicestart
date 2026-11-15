import "server-only";
import {
  NAVBAR_TREE,
  type NavbarEntry,
  type NavbarItem,
} from "@/features/navigation/navItems";
import { FEATURE_TOGGLES } from "@/features/registry";
import {
  audienceIfCurrent,
  getDashboardAudience,
  type MemberAudience,
} from "@/features/membership";
import { auth } from "@/core/auth/auth";
import {
  MemberTypeService,
  MembersService,
} from "@/features/membership/server";
import OrganizationConfigService from "@/core/config/OrganizationConfigService";

export default async function getNavbarItems(
  session: Awaited<ReturnType<typeof auth.api.getSession>>,
  orgId: string | undefined | null = session?.session.activeOrganizationId,
): Promise<NavbarItem[]> {
  const userId = session?.user.id;
  // One read of MemberTypesEnabled, for the audience and the member types.
  const memberTypesEnabledRead = orgId
    ? OrganizationConfigService.getMemberTypesEnabled(orgId)
    : Promise.resolve(false);
  const [orgConfig, membership, navbarConfig, memberTypesEnabled, memberTypes] =
    orgId
      ? await Promise.all([
          OrganizationConfigService.getConfig(orgId, FEATURE_TOGGLES),
          userId
            ? MembersService.findByUserAndOrganization(userId, orgId)
            : null,
          OrganizationConfigService.getNavbarConfig(orgId),
          memberTypesEnabledRead,
          memberTypesEnabledRead.then((enabled) =>
            enabled ? MemberTypeService.list(orgId) : Promise.resolve([]),
          ),
        ])
      : [{}, null, {}, false, []];
  const admin = MembersService.isAdminOrOwner(membership?.role);

  const typeKeys = memberTypes.map((row) => row.key);
  const navbarAudience: MemberAudience = (() => {
    if (!membership || admin) return "member";
    const current = audienceIfCurrent(
      getDashboardAudience(membership, memberTypesEnabled),
      typeKeys,
    );
    return current === "admin" ? "member" : current;
  })();

  // How this audience's navbar differs (#318). Admins always get the full
  // navbar, so the audience here is never "admin", and visitors who aren't
  // members get the plain navbar. Hiding is presentation
  // only; pages keep their own guards. Renamed labels can't break the navs'
  // dropdown state (keyed by label) because only admin items have subpages.
  const { hidden = [], labels = {} } =
    membership && !admin ? (navbarConfig[navbarAudience] ?? {}) : {};

  const enabled = orgConfig as Partial<Record<string, unknown>>;
  const isVisible = (page: NavbarEntry) => {
    if (page.requireAdmin && !admin) {
      return false;
    }
    if (page.toggle && !enabled[page.toggle]) {
      return false;
    }
    return !hidden.includes(page.href);
  };
  const relabel = <T extends NavbarEntry>(page: T): T =>
    labels[page.href] ? { ...page, label: labels[page.href] } : page;

  return NAVBAR_TREE.filter(isVisible).map((item) =>
    relabel({
      ...item,
      subpages: item.subpages?.filter(isVisible).map(relabel),
    }),
  ) as NavbarItem[];
}
