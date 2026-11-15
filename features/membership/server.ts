// The membership context's services, for other contexts' server code: import
// them from "@/features/membership/server". They're kept out of index.ts so that
// pure code (Zod contracts, lib/) importing a context never pulls in services,
// and through them the database and import cycles.

import { registerMembershipAuthHooks } from "./authHooks";

export { JoinRequestsService } from "./services/JoinRequestService";
export { MemberTypeService } from "./services/MemberTypeService";
export { MembersService } from "./services/MemberService";
// Users are a core table; re-exported here for membership's existing callers.
export { UserService } from "@/core/auth/UserService";

// Services here can remove members (JoinRequestsService.updateStatus), which
// fires BetterAuth's beforeRemoveMember hook. See core/auth/authHooks.ts.
registerMembershipAuthHooks();
