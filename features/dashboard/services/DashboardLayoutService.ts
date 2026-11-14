import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import { OrganizationConfigKey } from "@/core/config/schema";
import {
  type DashboardLayout,
  DashboardLayoutSchema,
} from "@/features/dashboard/lib/schema";

/*
 * Member types' own dashboard layouts, kept in one config row keyed by member
 * type. OrganizationConfigService.getDashboardLayoutFor reads them with the
 * member layout as the fallback.
 */

async function getLayouts(organizationId: string) {
  return (
    await OrganizationConfigService.getConfig(organizationId, [
      OrganizationConfigKey.MemberTypeDashboardLayouts,
    ])
  )[OrganizationConfigKey.MemberTypeDashboardLayouts];
}

/** A member type's own layout, or null when it uses the member layout. */
export async function getMemberTypeDashboardLayout(
  organizationId: string,
  memberType: string,
): Promise<DashboardLayout | null> {
  const layouts = await getLayouts(organizationId);
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
  const layouts = await getLayouts(organizationId);
  await OrganizationConfigService.setConfig(
    organizationId,
    OrganizationConfigKey.MemberTypeDashboardLayouts,
    { ...layouts, [memberType]: result.data },
  );
}

/** Deletes a member type's own layout, so it gets the member layout again. */
export async function clearMemberTypeDashboardLayout(
  organizationId: string,
  memberType: string,
) {
  const rest = { ...(await getLayouts(organizationId)) };
  delete rest[memberType];
  if (Object.keys(rest).length === 0) {
    await OrganizationConfigService.clearConfig(
      organizationId,
      OrganizationConfigKey.MemberTypeDashboardLayouts,
    );
  } else {
    await OrganizationConfigService.setConfig(
      organizationId,
      OrganizationConfigKey.MemberTypeDashboardLayouts,
      rest,
    );
  }
}
