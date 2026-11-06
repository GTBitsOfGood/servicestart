"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import authClient from "@/core/auth/authClient";
import { safeRedirectPath } from "@/core/auth/authValidation";
import { getSlugFromHost } from "@/core/tenant/clientAuthUtils";
import { useActiveOrganization } from "@/core/tenant/hooks/useActiveOrganization";

export function getRedirectPath() {
  return safeRedirectPath(
    new URLSearchParams(window.location.search).get("redirect"),
    window.location.origin,
  );
}

/**
 * Sends someone already signed in to this host's org away from a signed-out
 * page (login, signup).
 */
export function useRedirectIfSignedIn() {
  const router = useRouter();
  const org = useActiveOrganization();

  useEffect(() => {
    const checkLoggedIn = async () => {
      const session = await authClient.getSession();
      if (!session?.data?.user) return;

      if (org?.slug === getSlugFromHost(window.location.host)) {
        router.replace(getRedirectPath());
        router.refresh();
      }
    };

    void checkLoggedIn();
  }, [org?.slug, router]);
}
