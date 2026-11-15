import "server-only";

/*
 * BetterAuth lifecycle hooks that need a feature's code. auth.ts is core and
 * can't import features, so the membership context registers these and
 * auth.ts calls through them (see features/membership/authHooks.ts).
 *
 * The registry is kept on globalThis because Next can load this module more
 * than once (separate route bundles, HMR), and every copy must see the hooks.
 */

export type AuthHooks = {
  /** After any session is created: sign-up and sign-in. */
  afterSessionCreated: (userId: string, headers?: Headers) => Promise<void>;
  /** Before BetterAuth removes a member from an organization. */
  beforeRemoveMember: (member: {
    userId: string;
    organizationId: string;
  }) => Promise<void>;
};

const registry = globalThis as typeof globalThis & {
  __servicestartAuthHooks?: Partial<AuthHooks>;
};
const hooks = (registry.__servicestartAuthHooks ??= {});

export function registerAuthHooks(next: AuthHooks) {
  Object.assign(hooks, next);
}

/**
 * The registered hook. Throws if none is registered: running auth without
 * them would silently drop new users' join requests and memberships.
 */
export function getAuthHook<K extends keyof AuthHooks>(name: K): AuthHooks[K] {
  const hook = hooks[name];
  if (!hook) {
    throw new Error(
      `Auth hook "${name}" isn't registered. Call registerMembershipAuthHooks() from @/features/membership/authHooks in every entry point that can sign users up, sign them in, or remove members.`,
    );
  }
  return hook as AuthHooks[K];
}
