const defaultOrganizationSlug = "servicestart";

export function getSlugFromHost(host?: string): string {
  if (!host) return defaultOrganizationSlug;

  const normalized = host.toLowerCase().split(":")[0]; // Remove port if present
  const rootDomain =
    typeof process !== "undefined" && process.env.E2E_TENANT_DOMAIN
      ? process.env.E2E_TENANT_DOMAIN
      : "lvh.me"; // Default to new domain
  // Escape regex metacharacters in the domain before embedding in RegExp
  const escapedDomain = rootDomain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = normalized.match(
    new RegExp(`^([a-z0-9-]+)\\.${escapedDomain}$`),
  );

  return match ? match[1] : defaultOrganizationSlug;
}
