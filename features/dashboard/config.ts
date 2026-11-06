import { clearStoredConfigValue, jsonConfig } from "@/core/config/jsonConfig";
import { OrganizationConfigKey } from "@/core/config/schema";
import {
  DEFAULT_ADMIN_LAYOUT,
  DEFAULT_MEMBER_LAYOUT,
} from "@/features/dashboard/lib/constants";
import {
  DashboardHeaderConfigSchema,
  DEFAULT_DASHBOARD_HEADER_CONFIG,
} from "@/features/dashboard/lib/header";
import {
  type DashboardLayout,
  DashboardLayoutSchema,
  MemberTypeDashboardLayoutsSchema,
} from "@/features/dashboard/lib/schema";
import type { DashboardAudience } from "@/features/membership";

/*
 * The dashboard's config keys. OrganizationConfigService registers these
 * handlers (DASHBOARD_CONFIG), so getConfig and setConfig read and write them
 * as before. Server only.
 */

export const adminDashboardLayout = jsonConfig(
  OrganizationConfigKey.AdminDashboardLayout,
  "admin dashboard layout",
  DashboardLayoutSchema,
  DEFAULT_ADMIN_LAYOUT,
);

export const dashboardLayout = jsonConfig(
  OrganizationConfigKey.DashboardLayout,
  "dashboard layout",
  DashboardLayoutSchema,
  DEFAULT_MEMBER_LAYOUT,
);

// Member types' own layouts, in one row keyed by member type. A type without
// one gets the member layout (see getDashboardLayoutFor).
export const memberTypeDashboardLayouts = jsonConfig(
  OrganizationConfigKey.MemberTypeDashboardLayouts,
  "member type dashboard layouts",
  MemberTypeDashboardLayoutsSchema,
  {},
);

export const dashboardHeader = jsonConfig(
  OrganizationConfigKey.DashboardHeader,
  "dashboard header",
  DashboardHeaderConfigSchema,
  DEFAULT_DASHBOARD_HEADER_CONFIG,
);

/** The dashboard layout for an audience, falling back to the member layout. */
export async function getDashboardLayoutFor(
  organizationId: string,
  audience: DashboardAudience,
): Promise<DashboardLayout> {
  switch (audience) {
    case "admin":
      return adminDashboardLayout.get(organizationId);
    case "member":
      return dashboardLayout.get(organizationId);
    default:
      return (
        (await getMemberTypeDashboardLayout(organizationId, audience)) ??
        dashboardLayout.get(organizationId)
      );
  }
}

/** A member type's own layout, or null when it uses the member layout. */
export async function getMemberTypeDashboardLayout(
  organizationId: string,
  memberType: string,
): Promise<DashboardLayout | null> {
  const layouts = await memberTypeDashboardLayouts.get(organizationId);
  return Object.hasOwn(layouts, memberType) ? layouts[memberType] : null;
}

/** Saves a member type's own layout, leaving the other types' as they are. */
export async function setMemberTypeDashboardLayout(
  organizationId: string,
  memberType: string,
  layout: unknown,
) {
  const result = DashboardLayoutSchema.safeParse(layout);
  if (!result.success) {
    const [issue] = result.error.issues;
    const where = issue.path.length ? ` (${issue.path.join(".")})` : "";
    throw new Error(
      `Invalid ${memberType} dashboard layout${where}: ${issue.message}`,
    );
  }
  const layouts = await memberTypeDashboardLayouts.get(organizationId);
  await memberTypeDashboardLayouts.set(
    organizationId,
    JSON.stringify({ ...layouts, [memberType]: result.data }),
  );
}

/** Deletes a member type's own layout, so it gets the member layout again. */
export async function clearMemberTypeDashboardLayout(
  organizationId: string,
  memberType: string,
) {
  const rest = { ...(await memberTypeDashboardLayouts.get(organizationId)) };
  delete rest[memberType];
  if (Object.keys(rest).length === 0) {
    await clearStoredConfigValue(
      organizationId,
      OrganizationConfigKey.MemberTypeDashboardLayouts,
    );
  } else {
    await memberTypeDashboardLayouts.set(organizationId, JSON.stringify(rest));
  }
}

/** Handlers for OrganizationConfigService's key map. */
export const DASHBOARD_CONFIG = {
  [OrganizationConfigKey.AdminDashboardLayout]: adminDashboardLayout,
  [OrganizationConfigKey.DashboardLayout]: dashboardLayout,
  [OrganizationConfigKey.MemberTypeDashboardLayouts]:
    memberTypeDashboardLayouts,
  [OrganizationConfigKey.DashboardHeader]: dashboardHeader,
};
