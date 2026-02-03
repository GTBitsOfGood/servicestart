"use client";

import { useEffect, useRef, useState } from "react";
import authClient from "@/lib/authClient";

const ROOT_DOMAIN = "servicestart.com";
const DEFAULT_SLUG = "servicestart";

function getSlugFromHostname(hostname: string): string {
  if (hostname === ROOT_DOMAIN) return DEFAULT_SLUG;
  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const subdomain = hostname.slice(0, -ROOT_DOMAIN.length - 1);
    return subdomain || DEFAULT_SLUG;
  }
  return DEFAULT_SLUG;
}

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
    if (typeof window === "undefined") return;

    const updateSlug = () =>
      setSlug(getSlugFromHostname(window.location.hostname));

    updateSlug();
    window.addEventListener("popstate", updateSlug);
    return () => window.removeEventListener("popstate", updateSlug);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
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
