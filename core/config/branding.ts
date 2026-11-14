import { OrganizationConfigKey } from "@/core/config/schema";

export const DEFAULT_BRANDING = {
  [OrganizationConfigKey.PrimaryColor]: "#FD8033",
  [OrganizationConfigKey.SecondaryColor]: "#FB3552",
} as const satisfies Record<
  OrganizationConfigKey.PrimaryColor | OrganizationConfigKey.SecondaryColor,
  string
>;

export type BrandingConfig = {
  [OrganizationConfigKey.PrimaryColor]: string;
  [OrganizationConfigKey.SecondaryColor]: string;
};

export function resolveBranding(
  config: Partial<BrandingConfig>,
): BrandingConfig {
  return {
    [OrganizationConfigKey.PrimaryColor]:
      config[OrganizationConfigKey.PrimaryColor] ??
      DEFAULT_BRANDING[OrganizationConfigKey.PrimaryColor],
    [OrganizationConfigKey.SecondaryColor]:
      config[OrganizationConfigKey.SecondaryColor] ??
      DEFAULT_BRANDING[OrganizationConfigKey.SecondaryColor],
  };
}
