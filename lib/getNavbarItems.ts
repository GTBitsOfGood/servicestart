import { NAVBAR_ITEMS, NavbarItem } from "@/lib/navbar";
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
): Promise<NavbarItem[]> {
  const orgConfig = session?.session.activeOrganizationId
    ? await OrganizationConfigService.getConfig(
        session?.session.activeOrganizationId,
        getRelevantOrgConfigKeys(),
      )
    : {};

  const admin = await MembersService.isAdminOrderOwnerFromUserAndOrgId(
    session?.user.id,
    session?.session.activeOrganizationId,
  );

  const navbarItems = NAVBAR_ITEMS.filter((item) => {
    if (item.requireAdmin && !admin) {
      return false;
    }
    if (item.requireConfig) {
      const configValue = orgConfig[item.requireConfig];
      if (!configValue) {
        return false;
      }
    }
    return true;
  }).map((item) => {
    const filteredSubpages = item.subpages?.filter((sub) => {
      if (sub.requireAdmin && !admin) {
        return false;
      }
      if (sub.requireConfig) {
        const configValue = orgConfig[sub.requireConfig];
        if (!configValue) {
          return false;
        }
      }
      return true;
    });

    return { ...item, subpages: filteredSubpages };
  });

  return navbarItems;
}
