"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import authClient from "@/lib/authClient";
import { safeRedirectPath } from "@/lib/authValidation";
import { getSlugFromHost } from "@/lib/clientAuthUtils";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";

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
      }
    };

    void checkLoggedIn();
  }, [org?.slug, router]);
}
