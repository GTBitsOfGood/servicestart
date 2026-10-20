import { z } from "zod";
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
      {
        label: "Forms",
        href: "/settings/forms",
        requireAdmin: true,
        requireConfig: OrganizationConfigKey.FormsEnabled,
      },
      { label: "Admin Dashboard", href: "/settings/admindashboard" },
      { label: "Dashboard", href: "/settings/dashboard" },
    ],
  },
  { label: "Events", href: "/events", icon: "calendar" },
];

const NAVBAR_HREFS: ReadonlySet<string> = new Set(
  NAVBAR_ITEMS.flatMap((item) => [
    item.href,
    ...(item.subpages ?? []).map((page) => page.href),
  ]),
);

const NavbarHrefSchema = z
  .string()
  .refine((href) => NAVBAR_HREFS.has(href), "Not a navbar item");

const NavbarAudienceConfigSchema = z.strictObject({
  /** Navbar items, by href, this audience doesn't see. */
  hidden: z.array(NavbarHrefSchema).optional(),
  /** New labels for navbar items, by href. */
  labels: z
    .record(NavbarHrefSchema, z.string().trim().min(1).max(40))
    .optional(),
});
export type NavbarAudienceConfig = z.infer<typeof NavbarAudienceConfigSchema>;

/**
 * How the navbar differs per audience (#318). Admins always get the full
 * admin navbar. Hiding an item only hides it; it doesn't restrict the page.
 */
export const NavbarConfigSchema = z.strictObject({
  member: NavbarAudienceConfigSchema.optional(),
  applicant: NavbarAudienceConfigSchema.optional(),
  attendee: NavbarAudienceConfigSchema.optional(),
});
export type NavbarConfig = z.infer<typeof NavbarConfigSchema>;

export const DEFAULT_NAVBAR_CONFIG: NavbarConfig = {};

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
