import type { ConfigValues } from "@/core/config/registry";
import { OrganizationConfigKey } from "@/core/config/schema";
import { configStore } from "@/core/config/store";
import {
  ORGANIZATION_THEME_CONFIG_KEYS,
  type OrganizationThemeConfig,
} from "@/core/config/theme";

/*
 * Per-organization settings. Every key is declared once, with its schema,
 * default, and audience, in its context's config.ts (collected in
 * core/config/registry.ts); these functions read and write any of them.
 */

/** Each key's value, typed by its definition. Unknown keys are skipped. */
function getConfig<K extends OrganizationConfigKey>(
  organizationId: string,
  keys: readonly K[],
): Promise<ConfigValues<K>> {
  return configStore.get(organizationId, keys);
}

/**
 * Validates and stores a value, as a typed value or its stored text ("true",
 * a JSON string). Throws ConfigValidationError with a message for the admin.
 */
function setConfig(
  organizationId: string,
  key: OrganizationConfigKey,
  value: unknown,
): Promise<void> {
  return configStore.set(organizationId, key, value);
}

/** Removes a config row, so its key goes back to its default. */
function clearConfig(
  organizationId: string,
  key: OrganizationConfigKey,
): Promise<void> {
  return configStore.clear(organizationId, key);
}

/**
 * Only the theme keys the organization has set. The theme tells "never
 * configured" apart from "configured", so this doesn't fill in defaults.
 */
async function getThemeConfig(
  organizationId: string,
): Promise<OrganizationThemeConfig> {
  return configStore.getExplicit(
    organizationId,
    ORGANIZATION_THEME_CONFIG_KEYS,
  );
}

/**
 * The dashboard layout for an audience ("admin", "member", or a member type's
 * key). A member type without its own layout gets the member layout.
 */
async function getDashboardLayoutFor(organizationId: string, audience: string) {
  if (audience === "admin") {
    return configStore.getOne(
      organizationId,
      OrganizationConfigKey.AdminDashboardLayout,
    );
  }
  const {
    [OrganizationConfigKey.DashboardLayout]: memberLayout,
    [OrganizationConfigKey.MemberTypeDashboardLayouts]: byMemberType,
  } = await configStore.get(organizationId, [
    OrganizationConfigKey.DashboardLayout,
    OrganizationConfigKey.MemberTypeDashboardLayouts,
  ]);
  if (audience !== "member" && Object.hasOwn(byMemberType, audience)) {
    return byMemberType[audience];
  }
  return memberLayout;
}

const getter =
  <K extends OrganizationConfigKey>(key: K) =>
  (organizationId: string) =>
    configStore.getOne(organizationId, key);

const setter =
  (key: OrganizationConfigKey) => (organizationId: string, value: unknown) =>
    configStore.set(organizationId, key, value);

export const OrganizationConfigService = {
  getConfig,
  getThemeConfig,
  setConfig,
  clearConfig,
  getDashboardLayoutFor,
  getDashboardHeader: getter(OrganizationConfigKey.DashboardHeader),
  getNavbarConfig: getter(OrganizationConfigKey.NavbarConfig),
  getOrganizationFooter: getter(OrganizationConfigKey.OrganizationFooter),
  getAdminDashboardLayout: getter(OrganizationConfigKey.AdminDashboardLayout),
  setAdminDashboardLayout: setter(OrganizationConfigKey.AdminDashboardLayout),
  getDashboardLayout: getter(OrganizationConfigKey.DashboardLayout),
  setDashboardLayout: setter(OrganizationConfigKey.DashboardLayout),
  getMemberTypesEnabled: getter(OrganizationConfigKey.MemberTypesEnabled),
  getAutoApproveSignups: getter(OrganizationConfigKey.AutoApproveSignups),
};

export default OrganizationConfigService;
