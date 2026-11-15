import { ORGANIZATION_NOT_FOUND_PATH } from "@/core/tenant/organizationRoutes";
import type { IconName } from "@/components/bog/BogIcon/BogIcon";
import type { ToggleableOrganizationFeature } from "@/core/config/schema";
import { FEATURES } from "@/features/registry";

export type Page = {
  label: string;
  href: string;
  requireAdmin?: boolean;
};

export type NavbarItem = Page & {
  icon: IconName;
  subpages?: Page[];
};

export type NavbarProps = {
  items: NavbarItem[];
};

/** A navbar entry from a feature manifest, with the feature's toggle. */
export type NavbarEntry = Page & {
  icon?: IconName;
  toggle?: ToggleableOrganizationFeature;
  subpages?: NavbarEntry[];
};

const byOrder = (a: { order: number }, b: { order: number }) =>
  a.order - b.order;

const ENTRIES = FEATURES.flatMap(({ toggle, navItems = [] }) =>
  navItems.map((item) => ({ ...item, toggle })),
);

/**
 * The full navbar from every feature's manifest, before any per-org or
 * per-user filtering: top-level items and their subpages, each by `order`.
 */
export const NAVBAR_TREE: NavbarEntry[] = ENTRIES.filter(
  (entry) => !entry.parent,
)
  .sort(byOrder)
  .map(({ label, href, icon, requireAdmin, toggle }) => {
    const subpages = ENTRIES.filter((entry) => entry.parent === href)
      .sort(byOrder)
      .map((page) => ({
        label: page.label,
        href: page.href,
        requireAdmin: page.requireAdmin,
        toggle: page.toggle,
      }));
    return {
      label,
      href,
      icon,
      requireAdmin,
      toggle,
      ...(subpages.length ? { subpages } : {}),
    };
  });

/**
 * Every navbar item's href, including settings sub-items. Never filtered by
 * toggle: stored NavbarConfig rows are keyed by href and checked against it.
 */
export const NAVBAR_HREFS: ReadonlySet<string> = new Set(
  ENTRIES.map((entry) => entry.href),
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
