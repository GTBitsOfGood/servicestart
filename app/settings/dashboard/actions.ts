"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  MEMBER_AUDIENCES,
  MEMBER_TYPE_LAYOUT_KEYS,
} from "@/lib/dashboard/audience";
import type { DashboardLayout } from "@/lib/dashboard/schema";
import {
  ForbiddenError,
  NoActiveOrganizationError,
  UnauthorizedError,
} from "@/lib/errors";
import { MembersService } from "@/lib/services/MemberService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";

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

/** Saves an audience's dashboard layout under its own config key. */
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
    await OrganizationConfigService.setConfig(
      orgId,
      MEMBER_TYPE_LAYOUT_KEYS[parsed],
      value,
    );
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
  await OrganizationConfigService.clearConfig(
    orgId,
    MEMBER_TYPE_LAYOUT_KEYS[parsed],
  );
  revalidatePath("/settings/dashboard");
}
