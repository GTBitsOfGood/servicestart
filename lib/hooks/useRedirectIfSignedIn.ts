"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import authClient from "@/lib/authClient";
import { getSlugFromHost } from "@/lib/clientAuthUtils";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";

/**
 * Sends someone already signed in to this host's org away from a signed-out
 * page (login, signup). `getPath` runs in the browser when redirecting.
 */
export function useRedirectIfSignedIn(getPath: () => string) {
  const router = useRouter();
  const org = useActiveOrganization();

  useEffect(() => {
    const checkLoggedIn = async () => {
      const session = await authClient.getSession();
      if (!session?.data?.user) {
        return;
      }

      if (org?.slug === getSlugFromHost(window.location.host)) {
        router.replace(getPath());
      }
    };

    void checkLoggedIn();
  }, [org?.slug, router, getPath]);
}
