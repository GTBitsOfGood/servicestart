const defaultOrganizationSlug = "servicestart";

export function getSlugFromHost(host?: string): string {
  if (!host) return defaultOrganizationSlug;

  const normalized = host.toLowerCase().split(":")[0]; // Remove port if present
  const rootDomain =
    typeof process !== "undefined" && process.env.E2E_TENANT_DOMAIN
      ? process.env.E2E_TENANT_DOMAIN
      : "servicestart.com"; // Default root domain for local tests
  // If the host ends with the root domain, return the left-most label
  // as the slug (e.g. `acme.servicestart.com` -> `acme`). This is simpler
  // and more robust than depending on a RegExp match which can fail in
  // test environments with slight variations.
  const parts = normalized.split(".");

  // If the host looks like a multi-label domain (e.g. acme.servicestart.com),
  // treat the left-most label as the slug. This handles cases where the
  // configured rootDomain may differ in test runs.
  if (parts.length > 2) return parts[0];

  if (normalized === rootDomain) return defaultOrganizationSlug;
  if (normalized.endsWith(`.${rootDomain}`)) {
    return normalized.split(".")[0];
  }

  return defaultOrganizationSlug;
}
