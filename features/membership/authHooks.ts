import "server-only";
import { registerAuthHooks } from "@/core/auth/authHooks";
import * as hooks from "./services/MembershipAuthHooks";

/**
 * Registers membership's BetterAuth hooks (signup join requests and
 * memberships, member removal). Safe to call more than once.
 *
 * Call it explicitly from every entry point that can fire a hook: the auth
 * route, features/app.ts, membership's server.ts, seed scripts, and the e2e
 * helpers. core/auth/auth.ts throws if a hook fires before this ran.
 */
export function registerMembershipAuthHooks() {
  registerAuthHooks({
    // Looked up when a hook runs, not now, because the hooks' module may
    // still be loading when this is called from inside an import cycle.
    afterSessionCreated: (userId, headers) =>
      hooks.afterUserCreated(userId, headers),
    beforeRemoveMember: (member) => hooks.beforeRemoveMember(member),
  });
}
