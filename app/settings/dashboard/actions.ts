"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/core/auth/auth";
import {
  clearMemberTypeDashboardLayout,
  setMemberTypeDashboardLayout,
} from "@/features/dashboard/server";
import type { MemberAudience } from "@/features/membership/lib/audience";
import type { DashboardLayout } from "@/features/dashboard/lib/schema";
import {
  ForbiddenError,
  NoActiveOrganizationError,
  UnauthorizedError,
} from "@/core/api/errors";
import { MembersService } from "@/features/membership/services/MemberService";
import { MemberTypeService } from "@/features/membership/server";
import { MemberTypeKeySchema } from "@/features/membership/lib/memberTypeKey";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";

/** The active org of a signed-in admin or owner; throws otherwise. */
async function getAdminOrganizationId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new UnauthorizedError();

  const orgId = session.session.activeOrganizationId;
  if (!orgId) throw new NoActiveOrganizationError();

  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    orgId,
  );
  if (!MembersService.isAdminOrOwner(membership?.role)) {
    throw new ForbiddenError();
  }
  return orgId;
}

const parseMemberAudience = async (
  organizationId: string,
  audience: unknown,
): Promise<MemberAudience> => {
  if (audience === "member") {
    return "member";
  }
  const parsed = MemberTypeKeySchema.safeParse(audience);
  if (!parsed.success) {
    throw parsed.error;
  }
  const unknown = await MemberTypeService.findUnknownKeys(organizationId, [
    parsed.data,
  ]);
  if (unknown.length > 0) {
    throw new Error(`Unknown audience: ${String(audience)}`);
  }
  return parsed.data;
};

/**
 * Saves an audience's dashboard layout: members' under DashboardLayout, a
 * member type's in MemberTypeDashboardLayouts.
 */
export async function saveDashboardLayout(
  audience: unknown,
  layout: DashboardLayout,
) {
  const orgId = await getAdminOrganizationId();
  const parsed = await parseMemberAudience(orgId, audience);
  const value = JSON.stringify(layout);
  if (parsed === "member") {
    await OrganizationConfigService.setDashboardLayout(orgId, value);
  } else {
    await setMemberTypeDashboardLayout(orgId, parsed, JSON.parse(value));
  }
  revalidatePath("/settings/dashboard");
}

/**
 * Deletes a member type's own layout, so they get the member layout again.
 */
export async function clearDashboardLayout(audience: unknown) {
  const orgId = await getAdminOrganizationId();
  const parsed = await parseMemberAudience(orgId, audience);
  if (parsed === "member") {
    throw new Error("Cannot clear the member layout");
  }
  await clearMemberTypeDashboardLayout(orgId, parsed);
  revalidatePath("/settings/dashboard");
}
