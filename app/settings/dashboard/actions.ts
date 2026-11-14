"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/core/auth/auth";
import {
  clearMemberTypeDashboardLayout,
  setMemberTypeDashboardLayout,
} from "@/features/dashboard/server";
import { MEMBER_AUDIENCES } from "@/features/membership/lib/audience";
import type { DashboardLayout } from "@/features/dashboard/lib/schema";
import {
  ForbiddenError,
  NoActiveOrganizationError,
  UnauthorizedError,
} from "@/core/api/errors";
import { MembersService } from "@/features/membership/services/MemberService";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";

const AudienceSchema = z.enum(MEMBER_AUDIENCES);
const TypedAudienceSchema = AudienceSchema.exclude(["member"]);

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

/**
 * Saves an audience's dashboard layout: members' under DashboardLayout, a
 * member type's in MemberTypeDashboardLayouts.
 */
export async function saveDashboardLayout(
  audience: unknown,
  layout: DashboardLayout,
) {
  const orgId = await getAdminOrganizationId();
  const parsed = AudienceSchema.parse(audience);
  const value = JSON.stringify(layout);
  if (parsed === "member") {
    await OrganizationConfigService.setDashboardLayout(orgId, value);
  } else {
    await setMemberTypeDashboardLayout(orgId, parsed, JSON.parse(value));
  }
  revalidatePath("/settings/dashboard");
}

/**
 * Deletes applicants' or attendees' own layout, so they get the member
 * layout again.
 */
export async function clearDashboardLayout(audience: unknown) {
  const orgId = await getAdminOrganizationId();
  const parsed = TypedAudienceSchema.parse(audience);
  await clearMemberTypeDashboardLayout(orgId, parsed);
  revalidatePath("/settings/dashboard");
}
