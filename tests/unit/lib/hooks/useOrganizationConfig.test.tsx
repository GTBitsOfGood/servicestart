import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationConfigKey } from "@/lib/schema";
import useOrganizationConfig from "@/lib/hooks/useOrganizationConfig";

const mockSetActive = vi.fn();
const mockUseSession = vi.fn();

vi.mock("next/navigation", () => ({}));

vi.mock("@/lib/authClient", () => ({
  default: {
    useSession: () => mockUseSession(),
    useActiveOrganization: () => ({ data: null }),
    organization: {
      setActive: (args: { organizationSlug: string }) => mockSetActive(args),
    },
  },
}));

vi.mock("@/lib/hooks/useActiveOrganization", () => ({
  useActiveOrganization: () => ({ organization: { data: null } }),
}));

vi.mock("@/lib/clientAuthUtils", () => ({
  getSlugFromHost: () => "acme",
}));

const mockGet = vi.fn();
vi.mock("@/lib/api", () => ({
  default: {
    organizationConfig: {
      $get: (args: { query: { keys: string[]; organizationSlug: string } }) =>
        mockGet(args),
    },
  },
}));

describe("useOrganizationConfig", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    delete process.env.NEXT_PUBLIC_ORG_CONFIG_CACHE_DISABLED;
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, host: "acme.servicestart.com" },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });
  });

  it("fetches config values based on keys and slug from hostname", async () => {
    mockGet.mockImplementation((args) => {
      if (args.query.organizationSlug !== "acme") {
        throw new Error(
          `Unexpected organization slug: ${args.query.organizationSlug}`,
        );
      }

      if (
        args.query.keys.length !== 1 ||
        args.query.keys[0] !== OrganizationConfigKey.Description
      ) {
        throw new Error(`Unexpected keys: ${args.query.keys.join(",")}`);
      }

      return Promise.resolve({
        json: () =>
          Promise.resolve({
            [OrganizationConfigKey.Description]: "value1",
          }),
      });
    });

    const { result } = renderHook(() =>
      useOrganizationConfig([OrganizationConfigKey.Description]),
    );

    await waitFor(() => {
      expect(result.current[OrganizationConfigKey.Description]).toBe("value1");
    });
  });

  it("returns cached values when fresh", async () => {
    const cacheKey = "org-config:acme:description";
    window.localStorage.setItem(
      cacheKey,
      JSON.stringify({
        timestamp: Date.now(),
        value: "cached",
      }),
    );

    const { result } = renderHook(() =>
      useOrganizationConfig([OrganizationConfigKey.Description]),
    );

    await waitFor(() => {
      expect(result.current[OrganizationConfigKey.Description]).toBe("cached");
    });

    expect(mockGet).not.toHaveBeenCalled();
  });

  it("bypasses cache when disabled", async () => {
    process.env.NEXT_PUBLIC_ORG_CONFIG_CACHE_DISABLED = "true";
    const cacheKey = "org-config:acme:description";
    window.localStorage.setItem(
      cacheKey,
      JSON.stringify({
        timestamp: Date.now(),
        value: "cached",
      }),
    );

    mockGet.mockImplementation(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            [OrganizationConfigKey.Description]: "fresh",
          }),
      }),
    );

    const { result } = renderHook(() =>
      useOrganizationConfig([OrganizationConfigKey.Description]),
    );

    await waitFor(() => {
      expect(result.current[OrganizationConfigKey.Description]).toBe("fresh");
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("fetches only missing keys when some are cached", async () => {
    const descriptionKey = "org-config:acme:description";
    window.localStorage.setItem(
      descriptionKey,
      JSON.stringify({
        timestamp: Date.now(),
        value: "cached-description",
      }),
    );

    mockGet.mockImplementation((args) => {
      expect(args.query.organizationSlug).toBe("acme");
      expect(args.query.keys).toEqual([OrganizationConfigKey.Tagline]);

      return Promise.resolve({
        json: () =>
          Promise.resolve({
            [OrganizationConfigKey.Tagline]: "fresh-tagline",
          }),
      });
    });

    const keys = [
      OrganizationConfigKey.Description,
      OrganizationConfigKey.Tagline,
    ] as const;
    const { result } = renderHook(() => useOrganizationConfig(keys));

    await waitFor(() => {
      expect(result.current[OrganizationConfigKey.Description]).toBe(
        "cached-description",
      );
      expect(result.current[OrganizationConfigKey.Tagline]).toBe(
        "fresh-tagline",
      );
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
