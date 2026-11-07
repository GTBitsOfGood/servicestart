// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSlugFromHost } from "@/core/tenant/host";

afterEach(() => vi.unstubAllEnvs());
describe("getSlugFromHost", () => {
  it.each([
    [undefined, null],
    ["servicestart.com", null],
    ["acme.servicestart.com", "acme"],
    ["acme.lvh.me:3000", "acme"],
    ["lvh.me:3000", null],
    ["localhost:3000", null],
    ["127.0.0.1:3000", null],
    ["[::1]:3000", null],
    ["ACME.SERVICESTART.COM:443", "acme"],
    ["acme.servicestart.com.", "acme"],
    ["www.servicestart.com", null],
    ["www.lvh.me:3000", null],
    ["deploy-preview-335--servicestart.netlify.app", null],
    ["foo.example.com", null],
    ["foo.bar.servicestart.com", null],
    ["evilservicestart.com", null],
    ["acme.servicestart.com.evil.com", null],
    ["servicestart.servicestart.com", "servicestart"],
  ])("%s resolves to %s", (host, expected) => {
    vi.stubEnv("NEXT_PUBLIC_TENANT_ROOT_DOMAIN", "servicestart.com");
    // The old permissive parser mistook unrelated domains and Netlify deployment
    // names for tenants. Restricting to tenant roots matches browser behavior.
    expect(getSlugFromHost(host)).toBe(expected);
  });

  it("shares the configured root while retaining local lvh.me tenants", () => {
    vi.stubEnv("NEXT_PUBLIC_TENANT_ROOT_DOMAIN", "example.org");
    expect(getSlugFromHost("acme.example.org")).toBe("acme");
    expect(getSlugFromHost("acme.lvh.me:3000")).toBe("acme");
    expect(getSlugFromHost("acme.servicestart.com")).toBeNull();
  });
});
