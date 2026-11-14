// The membership context's public API: other contexts import from
// "@/features/membership", never from a file inside it.
// Its services are in ./server.ts, and its React components and widgets in
// ./ui.ts.

export { JoinRequestStatus } from "./schema";
export {
  audienceIfCurrent,
  getDashboardAudience,
  memberTypeFromAudience,
} from "./lib/audience";
export type { DashboardAudience, MemberAudience } from "./lib/audience";
export { MemberTypeKeySchema, type MemberTypeKey } from "./lib/memberTypeKey";
export { MemberTypeError } from "./lib/memberTypeErrors";
export type { MemberTypeRow } from "./services/MemberTypeService";
