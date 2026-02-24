const defaultOrganizationSlug = "servicestart";

export function getSlugFromHost(host?: string): string {
  if (!host) return defaultOrganizationSlug;

  const normalized = host.toLowerCase().split(":")[0]; // Remove port if present
  const match = normalized.match(/^([a-z0-9-]+)\.servicestart\.com$/);

  return match ? match[1] : defaultOrganizationSlug;
}
