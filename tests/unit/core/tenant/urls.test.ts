// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSlugFromHost } from "@/core/tenant/host";
import { getTenantOrigin } from "@/core/tenant/urls";

afterEach(() => vi.unstubAllEnvs());
describe("getTenantOrigin", () => {
  it.each([
    ["http://localhost:3000", "http://invited.lvh.me:3000"],
    ["http://127.0.0.1:3000", "http://invited.lvh.me:3000"],
    ["http://[::1]:3000", "http://invited.lvh.me:3000"],
    ["http://other.lvh.me:4000", "http://invited.lvh.me:4000"],
    ["https://example.org", "https://invited.example.org"],
    ["https://other.example.org", "https://invited.example.org"],
    [
      "https://deploy-preview-348--servicestart.netlify.app",
      "https://invited.example.org",
    ],
  ])("%s selects the invited tenant", (base, expected) => {
    vi.stubEnv("NEXT_PUBLIC_TENANT_ROOT_DOMAIN", "example.org");
    const origin = getTenantOrigin("invited", base);
    expect(origin).toBe(expected);
    expect(getSlugFromHost(new URL(origin).host)).toBe("invited");
  });
});
