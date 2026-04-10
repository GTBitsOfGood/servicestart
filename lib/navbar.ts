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
    label: "Menu Item",
    href: "/menu-parent",
    icon: "chats",
    subpages: [
      { label: "Subpage", href: "/subpage-1" },
      { label: "Subpage", href: "/subpage-2" },
    ],
  },
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
];

export const NO_NAVBAR_PAGES = [
  "/login",
  "/signup",
  "/joinrequeststatus",
  "/reset-password",
  "/forgot-password",
];
