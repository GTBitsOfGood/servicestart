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
  type DashboardLayout,
  DashboardLayoutSchema,
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

// Applicants' and attendees' layouts are null until set, and then the member
// layout applies (see getDashboardLayoutFor).
export const applicantDashboardLayout = jsonConfig<DashboardLayout | null>(
  OrganizationConfigKey.ApplicantDashboardLayout,
  "applicant dashboard layout",
  DashboardLayoutSchema,
  null,
);

export const attendeeDashboardLayout = jsonConfig<DashboardLayout | null>(
  OrganizationConfigKey.AttendeeDashboardLayout,
  "attendee dashboard layout",
  DashboardLayoutSchema,
  null,
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
    case "applicant":
      return (
        (await applicantDashboardLayout.get(organizationId)) ??
        dashboardLayout.get(organizationId)
      );
    case "attendee":
      return (
        (await attendeeDashboardLayout.get(organizationId)) ??
        dashboardLayout.get(organizationId)
      );
    case "member":
      return dashboardLayout.get(organizationId);
  }
}

/** Handlers for OrganizationConfigService's key map. */
export const DASHBOARD_CONFIG = {
  [OrganizationConfigKey.AdminDashboardLayout]: adminDashboardLayout,
  [OrganizationConfigKey.DashboardLayout]: dashboardLayout,
  [OrganizationConfigKey.ApplicantDashboardLayout]: applicantDashboardLayout,
  [OrganizationConfigKey.AttendeeDashboardLayout]: attendeeDashboardLayout,
  [OrganizationConfigKey.DashboardHeader]: dashboardHeader,
};
