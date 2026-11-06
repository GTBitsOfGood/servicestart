import { NAVBAR_ITEMS, NavbarItem, Page } from "@/features/navigation/navItems";
import {
  getDashboardAudience,
  type MemberAudience,
} from "@/features/membership";
import { OrganizationConfigKey } from "@/core/config/schema";
import { auth } from "@/core/auth/auth";
import { MembersService } from "@/features/membership";
import OrganizationConfigService from "@/core/config/OrganizationConfigService";

function getRelevantOrgConfigKeys(): OrganizationConfigKey[] {
  return NAVBAR_ITEMS.flatMap((item) => {
    const keys: OrganizationConfigKey[] = [];
    if (item.requireConfig) {
      keys.push(item.requireConfig);
    }
    item.subpages?.forEach((sub) => {
      if (sub.requireConfig) {
        keys.push(sub.requireConfig);
      }
    });
    return keys;
  });
}

export default async function getNavbarItems(
  session: Awaited<ReturnType<typeof auth.api.getSession>>,
  orgId: string | undefined | null = session?.session.activeOrganizationId,
): Promise<NavbarItem[]> {
  const userId = session?.user.id;
  const [orgConfig, membership, navbarConfig, memberTypesEnabled] = orgId
    ? await Promise.all([
        OrganizationConfigService.getConfig(orgId, getRelevantOrgConfigKeys()),
        userId ? MembersService.findByUserAndOrganization(userId, orgId) : null,
        OrganizationConfigService.getNavbarConfig(orgId),
        OrganizationConfigService.getMemberTypesEnabled(orgId),
      ])
    : [{}, null, {}, false];
  const admin = MembersService.isAdminOrOwner(membership?.role);

  // How this audience's navbar differs (#318). Admins always get the full
  // navbar, so the audience here is never "admin", and visitors who aren't
  // members get the plain navbar. Hiding is presentation
  // only; pages keep their own guards. Renamed labels can't break the navs'
  // dropdown state (keyed by label) because only admin items have subpages.
  const { hidden = [], labels = {} } =
    membership && !admin
      ? (navbarConfig[
          getDashboardAudience(membership, memberTypesEnabled) as MemberAudience
        ] ?? {})
      : {};

  const isVisible = (page: Page) => {
    if (page.requireAdmin && !admin) {
      return false;
    }
    if (page.requireConfig && !orgConfig[page.requireConfig]) {
      return false;
    }
    return !hidden.includes(page.href);
  };
  const relabel = <T extends Page>(page: T): T =>
    labels[page.href] ? { ...page, label: labels[page.href] } : page;

  return NAVBAR_ITEMS.filter(isVisible).map((item) =>
    relabel({
      ...item,
      subpages: item.subpages?.filter(isVisible).map(relabel),
    }),
  );
}
