import { z } from "zod";
import { configGroup, defineConfig } from "@/core/config/defineConfig";
import { OrganizationConfigKey } from "@/core/config/schema";
import {
  DEFAULT_ORGANIZATION_FOOTER,
  OrganizationFooterSchema,
} from "@/features/navigation/footer";
import {
  DEFAULT_NAVBAR_CONFIG,
  NavbarConfigSchema,
} from "@/features/navigation/navbarConfig";

// The navigation context's config keys. core/config/registry.ts collects them.

export const ALLOWED_NAVBAR_VARIANTS = [
  "vertical-sidebar",
  "vertical-icon",
  "horizontal-left",
  "horizontal-center",
  "horizontal-right",
] as const;

export type NavbarVariant = (typeof ALLOWED_NAVBAR_VARIANTS)[number];

export const ALLOWED_MOBILE_NAVBAR_VARIANTS = [
  "mobile-left-sidebar",
  "mobile-right-sidebar",
  "mobile-left-sidebar-icons",
  "mobile-right-sidebar-no-icons",
  "mobile-left-sidebar-pinned",
  "mobile-right-sidebar-pinned",
  "mobile-left-sidebar-pinned-icons",
  "mobile-right-sidebar-pinned-no-icons",
] as const;

export type MobileNavbarVariant =
  (typeof ALLOWED_MOBILE_NAVBAR_VARIANTS)[number];

export const MOBILE_PROFILE_ORIENTATIONS = ["vertical", "horizontal"] as const;

export type MobileProfileOrientation =
  (typeof MOBILE_PROFILE_ORIENTATIONS)[number];

// "inherit" deletes the row, so the value follows the mobile navbar variant.
function orInherit<S extends z.ZodType>(schema: S) {
  return z.preprocess(
    (value) => (value === "inherit" ? null : value),
    schema.nullable(),
  );
}

export const navbarVariant = defineConfig({
  key: OrganizationConfigKey.NavbarVariant,
  schema: z.enum(ALLOWED_NAVBAR_VARIANTS, {
    error: (issue) => `Invalid navbar variant: ${String(issue.input)}`,
  }),
  default: "vertical-sidebar",
  visibility: "admin",
});

export const mobileNavbarVariant = defineConfig({
  key: OrganizationConfigKey.MobileNavbarVariant,
  schema: z.enum(ALLOWED_MOBILE_NAVBAR_VARIANTS, {
    error: (issue) => `Invalid mobile navbar variant: ${String(issue.input)}`,
  }),
  default: "mobile-left-sidebar",
  visibility: "admin",
});

// null: follow the mobile navbar variant (see resolveMobileShowIcons).
export const mobileNavbarShowIcons = defineConfig({
  key: OrganizationConfigKey.MobileNavbarShowIcons,
  schema: orInherit(
    z.boolean({ error: "Value must be 'true', 'false', or 'inherit'" }),
  ),
  default: null,
  visibility: "admin",
});

// null: the default orientation (see resolveMobileProfileOrientation).
export const mobileNavbarProfileOrientation = defineConfig({
  key: OrganizationConfigKey.MobileNavbarProfileOrientation,
  schema: orInherit(
    z.enum(MOBILE_PROFILE_ORIENTATIONS, {
      error:
        "Profile orientation must be 'vertical', 'horizontal', or 'inherit'",
    }),
  ),
  default: null,
  visibility: "admin",
});

export const navbarColor = defineConfig({
  key: OrganizationConfigKey.NavbarColor,
  schema: z.enum(["red", "white"], {
    error: "Navbar color must be either 'red' or 'white'",
  }),
  default: "red",
  visibility: "admin",
});

export const navbarConfig = defineConfig({
  key: OrganizationConfigKey.NavbarConfig,
  schema: NavbarConfigSchema,
  default: DEFAULT_NAVBAR_CONFIG,
  visibility: "admin",
});

export const organizationFooter = defineConfig({
  key: OrganizationConfigKey.OrganizationFooter,
  schema: OrganizationFooterSchema,
  default: DEFAULT_ORGANIZATION_FOOTER,
  visibility: "admin",
  label: "footer",
});

export const NAVIGATION_CONFIG = configGroup(
  navbarVariant,
  mobileNavbarVariant,
  mobileNavbarShowIcons,
  mobileNavbarProfileOrientation,
  navbarColor,
  navbarConfig,
  organizationFooter,
);

/** Whether a mobile variant shows icons when the org hasn't chosen. */
export function mobileVariantShowsIcons(variant: MobileNavbarVariant) {
  return (
    variant.includes("icons") ||
    (variant.includes("right") && !variant.includes("no-icons"))
  );
}

/** The org's choice when it made one, otherwise the variant's. */
export function resolveMobileShowIcons(
  stored: boolean | null,
  variantDerived: boolean,
): boolean {
  return stored ?? variantDerived;
}

export function resolveMobileProfileOrientation(
  stored: MobileProfileOrientation | null,
): MobileProfileOrientation {
  return stored ?? "horizontal";
}
