import { clearStoredConfigValue, jsonConfig } from "@/core/config/jsonConfig";
import { OrganizationConfigKey } from "@/core/config/schema";
import {
  DEFAULT_ADMIN_LAYOUT,
  DEFAULT_MEMBER_LAYOUT,
} from "@/features/dashboard/lib/constants";
import { pruneAudienceRecord } from "@/features/dashboard/lib/audienceRecord";
import {
  DashboardHeaderConfigSchema,
  DEFAULT_DASHBOARD_HEADER_CONFIG,
} from "@/features/dashboard/lib/header";
import {
  type DashboardLayout,
  DashboardLayoutSchema,
  MemberTypeDashboardLayoutsSchema,
} from "@/features/dashboard/lib/schema";
import {
  audienceIfCurrent,
  type DashboardAudience,
  MemberTypeError,
  type MemberTypeKey,
} from "@/features/membership";

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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
const baseMemberTypeDashboardLayouts = jsonConfig(
  OrganizationConfigKey.MemberTypeDashboardLayouts,
  "member type dashboard layouts",
  MemberTypeDashboardLayoutsSchema,
  {},
);

export const memberTypeDashboardLayouts = {
  ...baseMemberTypeDashboardLayouts,
  async set(organizationId: string, value: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error("Invalid JSON for member type dashboard layouts");
    }
    if (!isJsonObject(parsed)) {
      throw new Error("Invalid JSON for member type dashboard layouts");
    }
    const keys = await orgMemberTypeKeys(organizationId);
    await baseMemberTypeDashboardLayouts.set(
      organizationId,
      JSON.stringify(pruneAudienceRecord(parsed, keys)),
    );
  },
};

const baseDashboardHeader = jsonConfig(
  OrganizationConfigKey.DashboardHeader,
  "dashboard header",
  DashboardHeaderConfigSchema,
  DEFAULT_DASHBOARD_HEADER_CONFIG,
);

const orgMemberTypeKeys = async (organizationId: string) => {
  const { MemberTypeService } = await import("@/features/membership/server");
  return (await MemberTypeService.list(organizationId)).map((row) => row.key);
};

export const dashboardHeader = {
  ...baseDashboardHeader,
  async set(organizationId: string, value: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error("Invalid JSON for dashboard header");
    }
    if (!isJsonObject(parsed)) {
      throw new Error("Invalid JSON for dashboard header");
    }
    const keys = await orgMemberTypeKeys(organizationId);
    await baseDashboardHeader.set(
      organizationId,
      JSON.stringify(pruneAudienceRecord(parsed, keys)),
    );
  },
};

/** The dashboard layout for an audience, falling back to the member layout. */
export async function getDashboardLayoutFor(
  organizationId: string,
  audience: DashboardAudience,
): Promise<DashboardLayout> {
  const keys = await orgMemberTypeKeys(organizationId);
  const current = audienceIfCurrent(audience, keys);
  switch (current) {
    case "admin":
      return adminDashboardLayout.get(organizationId);
    case "member":
      return dashboardLayout.get(organizationId);
    default:
      return (
        (await getMemberTypeDashboardLayout(organizationId, current)) ??
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
  const keys = await orgMemberTypeKeys(organizationId);
  if (!keys.includes(memberType as MemberTypeKey)) {
    throw new MemberTypeError("not_found", "Member type not found");
  }
  const layouts = await memberTypeDashboardLayouts.get(organizationId);
  const pruned = pruneAudienceRecord(
    { ...layouts, [memberType]: result.data },
    keys,
  );
  await memberTypeDashboardLayouts.set(organizationId, JSON.stringify(pruned));
}

/** Deletes a member type's own layout, so it gets the member layout again. */
export async function clearMemberTypeDashboardLayout(
  organizationId: string,
  memberType: string,
) {
  const layouts = await memberTypeDashboardLayouts.get(organizationId);
  const keys = await orgMemberTypeKeys(organizationId);
  const rest = pruneAudienceRecord(layouts, keys);
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
