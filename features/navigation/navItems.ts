import { ORGANIZATION_NOT_FOUND_PATH } from "@/core/tenant/organizationRoutes";
import type { IconName } from "@/components/bog/BogIcon/BogIcon";
import {
  OrganizationConfigKey,
  ToggleableOrganizationFeature,
} from "@/core/config/schema";

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
      {
        label: "Forms",
        href: "/settings/forms",
        requireAdmin: true,
        requireConfig: OrganizationConfigKey.FormsEnabled,
      },
      { label: "Admin Dashboard", href: "/settings/admindashboard" },
      { label: "Dashboard", href: "/settings/dashboard" },
      {
        label: "Dashboard Content",
        href: "/settings/dashboard-content",
        requireAdmin: true,
      },
    ],
  },
  { label: "Events", href: "/events", icon: "calendar" },
];

/** Every navbar item's href, including settings sub-items. */
export const NAVBAR_HREFS: ReadonlySet<string> = new Set(
  NAVBAR_ITEMS.flatMap((item) => [
    item.href,
    ...(item.subpages ?? []).map((page) => page.href),
  ]),
);

// Entries ending in "/" also match every path under them (see matchesPage).
export const NO_NAVBAR_PAGES = [
  ORGANIZATION_NOT_FOUND_PATH,
  "/login",
  "/signup",
  "/joinrequeststatus",
  "/resetpassword",
  "/forgotpassword",
  "/forms/",
  "/accept-invitation/",
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
