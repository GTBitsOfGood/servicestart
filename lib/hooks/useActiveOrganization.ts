"use client";

import { useEffect, useRef, useState } from "react";
import authClient from "@/lib/authClient";
import { DEFAULT_SLUG, getSlugFromHostname } from "@/lib/utils";

export function useActiveOrganization() {
  const organization = authClient.useActiveOrganization();
  const session = authClient.useSession();

  const [slug, setSlug] = useState<string>(() =>
    typeof window !== "undefined"
      ? getSlugFromHostname(window.location.hostname)
      : DEFAULT_SLUG,
  );

  const lastSetSlugRef = useRef<string | null>(null);

  useEffect(() => {
    const updateSlug = () =>
      setSlug(getSlugFromHostname(window.location.hostname));

    updateSlug();
    window.addEventListener("popstate", updateSlug);
    return () => window.removeEventListener("popstate", updateSlug);
  }, []);

  useEffect(() => {
    const hasSession = !!session?.data;
    const activeSlug = organization?.data?.slug ?? null;

    if (!hasSession) return;
    if (activeSlug === slug) return;
    if (lastSetSlugRef.current === slug) return;

    lastSetSlugRef.current = slug;
    authClient.organization.setActive({ organizationSlug: slug }).catch(() => {
      lastSetSlugRef.current = null;
    });
  }, [slug, session?.data, organization?.data?.slug]);

  return { slug, organization };
}
