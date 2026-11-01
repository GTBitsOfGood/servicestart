import { NAVBAR_ITEMS, NavbarItem, Page } from "@/lib/navbar";
import {
  getDashboardAudience,
  type MemberAudience,
} from "@/lib/dashboard/audience";
import { OrganizationConfigKey } from "./schema";
import { auth } from "./auth";
import { MembersService } from "./services/MemberService";
import OrganizationConfigService from "./services/OrganizationConfigService";

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
  const orgConfig = orgId
    ? await OrganizationConfigService.getConfig(
        orgId,
        getRelevantOrgConfigKeys(),
      )
    : {};

  const membership =
    session?.user.id && orgId
      ? await MembersService.findByUserAndOrganization(session.user.id, orgId)
      : null;
  const admin = MembersService.isAdminOrOwner(membership?.role);

  // How this audience's navbar differs (#318). Admins always get the full
  // navbar, so the audience here is never "admin". Hiding is presentation
  // only; pages keep their own guards. Renamed labels can't break the navs'
  // dropdown state (keyed by label) because only admin items have subpages.
  const { hidden = [], labels = {} } =
    !admin && orgId
      ? ((await OrganizationConfigService.getNavbarConfig(orgId))[
          getDashboardAudience(
            membership,
            await OrganizationConfigService.getMemberTypesEnabled(orgId),
          ) as MemberAudience
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
