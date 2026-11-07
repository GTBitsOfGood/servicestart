"use client";

import { useEffect, useRef, useState } from "react";
import authClient from "@/core/auth/authClient";
import { getSlugFromHost } from "@/core/tenant/host";

export function useActiveOrganization() {
  const organization = authClient.useActiveOrganization();
  const session = authClient.useSession();

  const [slug, setSlug] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? getSlugFromHost(window.location.hostname)
      : null,
  );

  const lastSetSlugRef = useRef<string | null>(null);

  useEffect(() => {
    const updateSlug = () => setSlug(getSlugFromHost(window.location.hostname));

    updateSlug();
    window.addEventListener("popstate", updateSlug);
    return () => window.removeEventListener("popstate", updateSlug);
  }, []);

  useEffect(() => {
    const hasSession = !!session?.data;
    const activeSlug = organization?.data?.slug ?? null;
    const activeOrganizationId = organization?.data?.id ?? null;
    const sessionOrganizationId =
      session?.data?.session.activeOrganizationId ?? null;

    if (!hasSession) return;
    if (!slug) return;
    if (activeSlug === slug && activeOrganizationId === sessionOrganizationId)
      return;
    if (lastSetSlugRef.current === slug) return;

    lastSetSlugRef.current = slug;
    authClient.organization.setActive({ organizationSlug: slug }).catch(() => {
      lastSetSlugRef.current = null;
    });
  }, [slug, session?.data, organization?.data?.id, organization?.data?.slug]);

  const activeId = session?.data?.session.activeOrganizationId;
  const data = organization.data;
  const matches = data && data.id === activeId && (!slug || data.slug === slug);
  return {
    slug: slug ?? (matches ? data.slug : null),
    organization: { ...organization, data: matches ? data : null },
  };
}
