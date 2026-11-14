import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import { OrganizationConfigKey } from "@/core/config/schema";
import { pruneAudienceRecord } from "@/features/dashboard/lib/audienceRecord";
import {
  type DashboardLayout,
  DashboardLayoutSchema,
} from "@/features/dashboard/lib/schema";
import { MemberTypeError, type MemberTypeKey } from "@/features/membership";
import { MemberTypeService } from "@/features/membership/server";

/*
 * Member types' own dashboard layouts, kept in one config row keyed by member
 * type. OrganizationConfigService.getDashboardLayoutFor reads them with the
 * member layout as the fallback. Saving drops entries for types the org no
 * longer has, so a new type that reuses a deleted type's key starts clean.
 */

async function getLayouts(organizationId: string) {
  return (
    await OrganizationConfigService.getConfig(organizationId, [
      OrganizationConfigKey.MemberTypeDashboardLayouts,
    ])
  )[OrganizationConfigKey.MemberTypeDashboardLayouts];
}

async function currentTypeKeys(
  organizationId: string,
): Promise<MemberTypeKey[]> {
  return (await MemberTypeService.list(organizationId)).map((row) => row.key);
}

/** A member type's own layout, or null when it uses the member layout. */
export async function getMemberTypeDashboardLayout(
  organizationId: string,
  memberType: string,
): Promise<DashboardLayout | null> {
  const layouts = await getLayouts(organizationId);
  return Object.hasOwn(layouts, memberType) ? layouts[memberType] : null;
}

/**
 * Saves a member type's own layout, leaving the other types' as they are.
 * Throws MemberTypeError when the org has no such type.
 */
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
  const keys = await currentTypeKeys(organizationId);
  if (!keys.includes(memberType as MemberTypeKey)) {
    throw new MemberTypeError("not_found", "Member type not found");
  }
  const layouts = await getLayouts(organizationId);
  await OrganizationConfigService.setConfig(
    organizationId,
    OrganizationConfigKey.MemberTypeDashboardLayouts,
    pruneAudienceRecord({ ...layouts, [memberType]: result.data }, keys),
  );
}

/** Deletes a member type's own layout, so it gets the member layout again. */
export async function clearMemberTypeDashboardLayout(
  organizationId: string,
  memberType: string,
) {
  const rest = pruneAudienceRecord(
    await getLayouts(organizationId),
    await currentTypeKeys(organizationId),
  );
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
