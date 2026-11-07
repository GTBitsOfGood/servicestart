import { getTenantRootDomain } from "@/core/tenant/host";

/** Build an absolute tenant origin without inheriting another tenant's host. */
export function getTenantOrigin(slug: string, baseUrl: string): string {
  const url = new URL(baseUrl);
  const local =
    ["localhost", "127.0.0.1", "[::1]", "lvh.me"].includes(url.hostname) ||
    url.hostname.endsWith(".lvh.me");
  url.hostname = `${slug}.${local ? "lvh.me" : getTenantRootDomain()}`;
  return url.origin;
}
