import type { IconName } from "@/components/bog/BogIcon/BogIcon";
import { OrganizationConfigKey, ToggleableOrganizationFeature } from "./schema";

export type Page = {
  label: string;
  href: string;
  requireAdmin?: boolean;
  requireConfig?: ToggleableOrganizationFeature;
};

export type NavbarItem = Page & {
  icon: IconName;
  subpages?: Page[];
};

export type NavbarProps = {
  items: NavbarItem[];
};

export const NAVBAR_ITEMS: NavbarItem[] = [
  { label: "Home", href: "/", icon: "house" },
  {
    label: "Members",
    href: "/members",
    icon: "users",
    requireAdmin: true,
    requireConfig: OrganizationConfigKey.MembersPageEnabled,
  },
  {
    label: "Media Library",
    href: "/media",
    icon: "folder",
    requireAdmin: true,
  },
  { label: "Inbox", href: "/inbox", icon: "bell" },
  {
    label: "Settings",
    href: "/settings",
    icon: "gear",
    requireAdmin: true,
    subpages: [
      { label: "Admin Dashboard", href: "/settings/admindashboard" },
      { label: "Dashboard", href: "/settings/dashboard" },
    ],
  },
  { label: "Events", href: "/events", icon: "calendar" },
];

export const NO_NAVBAR_PAGES = ["/login", "/signup", "/joinrequeststatus"];
