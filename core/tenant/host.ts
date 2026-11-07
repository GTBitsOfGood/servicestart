/** Domain shared by the server, browser, and edge parser. */
export function getTenantRootDomain(): string {
  return (
    process.env.NEXT_PUBLIC_TENANT_ROOT_DOMAIN ||
    process.env.E2E_TENANT_DOMAIN ||
    "servicestart.com"
  ).toLowerCase();
}

/** Only a single label beneath a tenant root identifies an organization. */
export function getSlugFromHost(host?: string | null): string | null {
  if (!host) return null;
  const hostname = host.toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  for (const root of new Set([getTenantRootDomain(), "lvh.me"])) {
    if (!hostname.endsWith(`.${root}`)) continue;
    const slug = hostname.slice(0, -root.length - 1);
    if (slug !== "www" && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug))
      return slug;
  }
  return null;
}
