import { configGroup, defineConfig } from "@/core/config/defineConfig";
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
 * and writing a member type's layout is in services/DashboardLayoutService.ts.
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

// Member types' own layouts, in one row keyed by member type key. A type
// without one gets the member layout (see getDashboardLayoutFor).
export const memberTypeDashboardLayouts = defineConfig({
  key: OrganizationConfigKey.MemberTypeDashboardLayouts,
  schema: MemberTypeDashboardLayoutsSchema,
  default: {},
  visibility: "admin",
});

export const dashboardHeader = defineConfig({
  key: OrganizationConfigKey.DashboardHeader,
  schema: DashboardHeaderConfigSchema,
  default: DEFAULT_DASHBOARD_HEADER_CONFIG,
  visibility: "admin",
});

export const DASHBOARD_CONFIG = configGroup(
  adminDashboardLayout,
  dashboardLayout,
  memberTypeDashboardLayouts,
  dashboardHeader,
);
