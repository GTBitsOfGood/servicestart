import type { MemberTypeKey } from "@/features/membership/lib/memberTypeKey";

/**
 * Who a dashboard (and its navbar and header) is for. Member types only count
 * while the org has MemberTypesEnabled on; otherwise every non-admin is a
 * member.
 */
export type DashboardAudience = "admin" | "member" | MemberTypeKey;

/** The audiences besides admins, which an org can configure separately. */
export type MemberAudience = "member" | MemberTypeKey;

export function getDashboardAudience(
  membership: { role: string; memberType: MemberTypeKey | null } | null,
  memberTypesEnabled: boolean,
): DashboardAudience {
  if (membership?.role === "admin" || membership?.role === "owner") {
    return "admin";
  }
  if (memberTypesEnabled && membership?.memberType) {
    return membership.memberType;
  }
  return "member";
}

/** The member type whose forms an audience sees, or null for none. */
export function memberTypeFromAudience(
  audience: DashboardAudience,
): MemberTypeKey | null {
  if (audience === "admin" || audience === "member") {
    return null;
  }
  return audience;
}

/** Maps a type audience to `member` when that key is no longer in the org. */
export function audienceIfCurrent(
  audience: DashboardAudience,
  keys: readonly MemberTypeKey[],
): DashboardAudience {
  if (audience === "admin" || audience === "member") {
    return audience;
  }
  return keys.includes(audience) ? audience : "member";
}
