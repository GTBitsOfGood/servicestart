// The membership context's public API: other contexts import from
// "@/features/membership", never from a file inside it.
// Its services are in ./server.ts, and its React components and widgets in
// ./ui.ts.

export { JoinRequestStatus, MemberType } from "./schema";
export { getDashboardAudience, memberTypeFromAudience } from "./lib/audience";
export type { DashboardAudience, MemberAudience } from "./lib/audience";
export {
  MEMBER_TYPE_LABELS,
  MEMBER_TYPE_PLURAL_LABELS,
} from "./lib/memberTypes";
