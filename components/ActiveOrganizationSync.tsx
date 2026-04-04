"use client";

import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";

/**
 * Playwright drives the app on localhost, where `getSlugFromHostname` resolves
 * to `servicestart`. Syncing the active org to that slug overwrites the
 * isolated organization set in DB for `createTestAdminAndSignIn`, so client
 * `fetch("/api/media", …)` runs with the wrong tenant and returns 403.
 */
function ActiveOrganizationSyncInner() {
  useActiveOrganization();
  return null;
}

export function ActiveOrganizationSync() {
  if (process.env.NEXT_PUBLIC_E2E_DISABLE_ACTIVE_ORG_SYNC === "true") {
    return null;
  }
  return <ActiveOrganizationSyncInner />;
}
