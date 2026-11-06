// The membership context's public API: other contexts import from
// "@/features/membership", never from a file inside it.
// Its React components and widgets are in ./ui.ts.

export { JoinRequestStatus, MemberType } from "./schema";
export { getDashboardAudience, memberTypeFromAudience } from "./lib/audience";
export type { DashboardAudience, MemberAudience } from "./lib/audience";
export {
  MEMBER_TYPE_LABELS,
  MEMBER_TYPE_PLURAL_LABELS,
} from "./lib/memberTypes";
export { JoinRequestsService } from "./services/JoinRequestService";
export { MembersService } from "./services/MemberService";
export { UserService } from "./services/UserService";
