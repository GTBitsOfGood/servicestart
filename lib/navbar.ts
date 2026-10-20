import { ORGANIZATION_NOT_FOUND_PATH } from "@/lib/organizationRoutes";
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

// Entries ending in "/" also match every path under them (see matchesPage).
export const NO_NAVBAR_PAGES = [
  ORGANIZATION_NOT_FOUND_PATH,
  "/login",
  "/signup",
  "/joinrequeststatus",
  "/resetpassword",
  "/forgotpassword",
  "/forms/",
];

/**
 * Whether `pathname` is one of `pages`. An entry ending in "/" matches any
 * path under it: "/forms/" matches "/forms/abc" but not "/forms" or
 * "/formsabc". Other entries match only the exact path.
 */
export function matchesPage(pathname: string, pages: readonly string[]) {
  return pages.some((page) =>
    page.endsWith("/") ? pathname.startsWith(page) : pathname === page,
  );
}

export function isNoNavbarPage(pathname: string) {
  return matchesPage(pathname, NO_NAVBAR_PAGES);
}

export const MEMBERSHIP_REDIRECT_EXCLUDED_PAGES = NO_NAVBAR_PAGES;
