import { MemberType } from "@/lib/schema";

/** How member types read in the app, e.g. in a member's Type column. */
export const MEMBER_TYPE_LABELS: Record<MemberType, string> = {
  [MemberType.Applicant]: "Applicant",
  [MemberType.Attendee]: "Current Attendee",
};

/** For a group of members, e.g. "Required for: Applicants". */
export const MEMBER_TYPE_PLURAL_LABELS: Record<MemberType, string> = {
  [MemberType.Applicant]: "Applicants",
  [MemberType.Attendee]: "Current Attendees",
};
