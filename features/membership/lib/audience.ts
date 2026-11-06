import { MemberType } from "@/features/membership/schema";

/**
 * Who a dashboard (and its navbar and header) is for. Member types only count
 * while the org has MemberTypesEnabled on; otherwise every non-admin is a
 * member.
 */
export const DASHBOARD_AUDIENCES = [
  "admin",
  "member",
  "applicant",
  "attendee",
] as const;
export type DashboardAudience = (typeof DASHBOARD_AUDIENCES)[number];

/** The audiences besides admins, which an org can configure separately. */
export const MEMBER_AUDIENCES = ["member", "applicant", "attendee"] as const;
export type MemberAudience = (typeof MEMBER_AUDIENCES)[number];

export function getDashboardAudience(
  membership: { role: string; memberType: MemberType | null } | null,
  memberTypesEnabled: boolean,
): DashboardAudience {
  if (membership?.role === "admin" || membership?.role === "owner") {
    return "admin";
  }
  if (memberTypesEnabled && membership?.memberType === MemberType.Applicant) {
    return "applicant";
  }
  if (memberTypesEnabled && membership?.memberType === MemberType.Attendee) {
    return "attendee";
  }
  return "member";
}

/** The member type whose forms an audience sees, or null for none. */
export function memberTypeFromAudience(
  audience: DashboardAudience,
): MemberType | null {
  if (audience === "applicant") return MemberType.Applicant;
  if (audience === "attendee") return MemberType.Attendee;
  return null;
}
