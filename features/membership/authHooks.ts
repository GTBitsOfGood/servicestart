import "server-only";
import { registerAuthHooks } from "@/core/auth/authHooks";

/*
 * The hook bodies load when a hook first runs, not when this registers them,
 * so registering is cheap and can't take part in an import cycle with auth.ts
 * (the bodies import services that import auth.ts).
 */
const load = () => import("./services/MembershipAuthHooks");

/**
 * Registers membership's BetterAuth hooks (signup join requests and
 * memberships, member removal). Safe to call more than once.
 *
 * Call it explicitly from every entry point that can fire a hook: the auth
 * route, features/app.ts, membership's server.ts, seed scripts, and the test
 * setups. core/auth/auth.ts throws if a hook fires before this ran.
 */
export function registerMembershipAuthHooks() {
  registerAuthHooks({
    afterSessionCreated: async (userId, headers) =>
      (await load()).afterUserCreated(userId, headers),
    beforeRemoveMember: async (member) =>
      (await load()).beforeRemoveMember(member),
  });
}
