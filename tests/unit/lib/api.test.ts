// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/clientUtils", () => ({
  getBaseUrl: () => "https://configured.servicestart.com",
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("typed API client origin", () => {
  it.each(["acme", "missing-tenant"])(
    "uses the visited %s tenant in a browser",
    async (slug) => {
      vi.stubGlobal("window", {
        location: { origin: `https://${slug}.servicestart.com` },
      });
      const { default: api } = await import("@/lib/api");
      expect(api.organizationConfig.$url().origin).toBe(
        `https://${slug}.servicestart.com`,
      );
    },
  );

  it("uses the configured absolute origin on the server", async () => {
    vi.stubGlobal("window", undefined);
    const { default: api } = await import("@/lib/api");
    expect(api.organizationConfig.$url().origin).toBe(
      "https://configured.servicestart.com",
    );
  });
});
