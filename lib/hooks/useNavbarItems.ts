import { NAVBAR_ITEMS, NavbarItem } from "@/lib/navbar";
import { useEffect, useState } from "react";
import authClient from "@/lib/authClient";
import useOrganizationConfig from "./useOrganizationConfig";
import { OrganizationConfigKey } from "../schema";
import { isAdmin } from "../clientUtils";

function getDefaultNavbarItems(): NavbarItem[] {
  return NAVBAR_ITEMS.filter((item) => {
    !item.requireAdmin && !item.requireConfig;
  }).map((item) => ({
    ...item,
    subpages: item.subpages?.filter(
      (sub) => !sub.requireAdmin && !sub.requireConfig,
    ),
  }));
}

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

export default function useNavbarItems(): NavbarItem[] {
  const [navbarItems, setNavbarItems] = useState<NavbarItem[]>(
    getDefaultNavbarItems(),
  );

  const organization = authClient.useActiveOrganization();
  const session = authClient.useSession();
  const orgConfig = useOrganizationConfig(getRelevantOrgConfigKeys());

  useEffect(() => {
    if (!session.data || !organization.data) {
      return;
    }

    const admin = isAdmin(organization.data, session.data.user);

    const filteredItems = NAVBAR_ITEMS.filter((item) => {
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

    setNavbarItems(filteredItems);
  }, [session.data, organization.data, orgConfig]);

  return navbarItems;
}
