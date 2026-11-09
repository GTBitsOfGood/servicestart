import { configGroup, defineConfig } from "@/core/config/defineConfig";
import { jsonConfig } from "@/core/config/jsonConfig";
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
  DashboardLayoutSchema,
  MemberTypeDashboardLayoutsSchema,
} from "@/features/dashboard/lib/schema";

/*
 * The dashboard's config keys. core/config/registry.ts collects them. Reading
 * a member type's layout is in services/DashboardLayoutService.ts.
 */

export const adminDashboardLayout = defineConfig({
  key: OrganizationConfigKey.AdminDashboardLayout,
  schema: DashboardLayoutSchema,
  default: DEFAULT_ADMIN_LAYOUT,
  visibility: "admin",
});

export const dashboardLayout = defineConfig({
  key: OrganizationConfigKey.DashboardLayout,
  schema: DashboardLayoutSchema,
  default: DEFAULT_MEMBER_LAYOUT,
  visibility: "admin",
});

// Member types' own layouts, in one row keyed by member type. A type without
// one gets the member layout (see getDashboardLayoutFor).
export const memberTypeDashboardLayouts = jsonConfig(
  OrganizationConfigKey.MemberTypeDashboardLayouts,
  "member type dashboard layouts",
  MemberTypeDashboardLayoutsSchema,
  {},
);

export const dashboardHeader = defineConfig({
  key: OrganizationConfigKey.DashboardHeader,
  schema: DashboardHeaderConfigSchema,
  default: DEFAULT_DASHBOARD_HEADER_CONFIG,
  visibility: "admin",
});

// Replaced by MemberTypeDashboardLayouts; #333's migration moved their rows.
// Nothing reads them, and #336 removes the keys.
export const applicantDashboardLayout = defineConfig({
  key: OrganizationConfigKey.ApplicantDashboardLayout,
  schema: DashboardLayoutSchema.nullable(),
  default: null,
  visibility: "admin",
});

export const attendeeDashboardLayout = defineConfig({
  key: OrganizationConfigKey.AttendeeDashboardLayout,
  schema: DashboardLayoutSchema.nullable(),
  default: null,
  visibility: "admin",
});

export const DASHBOARD_CONFIG = configGroup(
  adminDashboardLayout,
  dashboardLayout,
  memberTypeDashboardLayouts,
  dashboardHeader,
  applicantDashboardLayout,
  attendeeDashboardLayout,
);
