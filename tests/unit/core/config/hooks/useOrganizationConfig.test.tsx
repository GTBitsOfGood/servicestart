// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationConfigKey } from "@/core/db/schema";
import useOrganizationConfig from "@/core/config/hooks/useOrganizationConfig";
import { DEFAULT_BRANDING, resolveBranding } from "@/core/config/branding";

const mockSetActive = vi.fn();
const mockUseSession = vi.fn();

vi.mock("next/navigation", () => ({}));

vi.mock("@/core/auth/authClient", () => ({
  default: {
    useSession: () => mockUseSession(),
    useActiveOrganization: () => ({ data: null }),
    organization: {
      setActive: (args: { organizationSlug: string }) => mockSetActive(args),
    },
  },
}));

vi.mock("@/core/tenant/hooks/useActiveOrganization", () => ({
  useActiveOrganization: () => ({ organization: { data: null } }),
}));

vi.mock("@/core/tenant/clientAuthUtils", () => ({
  getSlugFromHost: () => "acme",
}));

const mockGet = vi.fn();
vi.mock("@/core/api/client", () => ({
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
        ok: true,
        status: 200,
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
    const cacheKey = "org-config:v3:acme:tagline";
    window.localStorage.setItem(
      cacheKey,
      JSON.stringify({
        timestamp: Date.now(),
        value: "cached",
      }),
    );

    const { result } = renderHook(() =>
      useOrganizationConfig([OrganizationConfigKey.Tagline]),
    );

    await waitFor(() => {
      expect(result.current[OrganizationConfigKey.Tagline]).toBe("cached");
    });

    expect(mockGet).not.toHaveBeenCalled();
  });

  it("bypasses cache when disabled", async () => {
    process.env.NEXT_PUBLIC_ORG_CONFIG_CACHE_DISABLED = "true";
    const cacheKey = "org-config:v3:acme:tagline";
    window.localStorage.setItem(
      cacheKey,
      JSON.stringify({
        timestamp: Date.now(),
        value: "cached",
      }),
    );

    mockGet.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            [OrganizationConfigKey.Tagline]: "fresh",
          }),
      }),
    );

    const { result } = renderHook(() =>
      useOrganizationConfig([OrganizationConfigKey.Tagline]),
    );

    await waitFor(() => {
      expect(result.current[OrganizationConfigKey.Tagline]).toBe("fresh");
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("fetches only missing keys when some are cached", async () => {
    const taglineKey = "org-config:v3:acme:tagline";
    window.localStorage.setItem(
      taglineKey,
      JSON.stringify({
        timestamp: Date.now(),
        value: "cached-tagline",
      }),
    );

    mockGet.mockImplementation((args) => {
      expect(args.query.organizationSlug).toBe("acme");
      expect(args.query.keys).toEqual([OrganizationConfigKey.PrimaryColor]);

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            [OrganizationConfigKey.PrimaryColor]: "#000000",
          }),
      });
    });

    const keys = [
      OrganizationConfigKey.Tagline,
      OrganizationConfigKey.PrimaryColor,
    ] as const;
    const { result } = renderHook(() => useOrganizationConfig(keys));

    await waitFor(() => {
      expect(result.current[OrganizationConfigKey.Tagline]).toBe(
        "cached-tagline",
      );
      expect(result.current[OrganizationConfigKey.PrimaryColor]).toBe(
        "#000000",
      );
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("reports not-found and caches nothing when the org does not exist", async () => {
    mockGet.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Organization not found" }),
      }),
    );

    const { result } = renderHook(() =>
      useOrganizationConfig([OrganizationConfigKey.PrimaryColor]),
    );

    await waitFor(() => {
      expect(result.current.status).toBe("not-found");
    });

    expect(result.current[OrganizationConfigKey.PrimaryColor]).toBeUndefined();
    expect(window.localStorage.length).toBe(0);
  });

  it("reports error and caches nothing on a server error", async () => {
    mockGet.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "boom" }),
      }),
    );

    const { result } = renderHook(() =>
      useOrganizationConfig([OrganizationConfigKey.PrimaryColor]),
    );

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current[OrganizationConfigKey.PrimaryColor]).toBeUndefined();
    expect(window.localStorage.length).toBe(0);
  });

  it("reports error and caches nothing on a network failure", async () => {
    mockGet.mockImplementation(() => Promise.reject(new Error("network down")));

    const { result } = renderHook(() =>
      useOrganizationConfig([OrganizationConfigKey.PrimaryColor]),
    );

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(window.localStorage.length).toBe(0);
  });

  it("reports ok and caches the value on success", async () => {
    mockGet.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            [OrganizationConfigKey.Tagline]: "value1",
          }),
      }),
    );

    const { result } = renderHook(() =>
      useOrganizationConfig([OrganizationConfigKey.Tagline]),
    );

    await waitFor(() => {
      expect(result.current.status).toBe("ok");
    });

    expect(window.localStorage.getItem("org-config:v3:acme:tagline")).toContain(
      "value1",
    );
  });

  // An org that exists but has no branding rows is NOT missing: the server
  // supplies defaults (OrganizationConfigService.getPrimaryColor), so the page
  // must render normally rather than showing the not-found state.
  it("treats an existing org with server-default branding as ok", async () => {
    mockGet.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            [OrganizationConfigKey.PrimaryColor]: "#FD8033",
            [OrganizationConfigKey.SecondaryColor]: "#FB3552",
          }),
      }),
    );

    const keys = [
      OrganizationConfigKey.PrimaryColor,
      OrganizationConfigKey.SecondaryColor,
    ] as const;
    const { result } = renderHook(() => useOrganizationConfig(keys));

    await waitFor(() => {
      expect(result.current[OrganizationConfigKey.PrimaryColor]).toBe(
        "#FD8033",
      );
    });

    expect(result.current.status).toBe("ok");
    expect(result.current[OrganizationConfigKey.SecondaryColor]).toBe(
      "#FB3552",
    );
  });

  it("resolves to documented defaults when the hook has not loaded branding yet", () => {
    const branding = resolveBranding({});

    expect(branding[OrganizationConfigKey.PrimaryColor]).toBe(
      DEFAULT_BRANDING[OrganizationConfigKey.PrimaryColor],
    );
    expect(branding[OrganizationConfigKey.SecondaryColor]).toBe(
      DEFAULT_BRANDING[OrganizationConfigKey.SecondaryColor],
    );
  });

  // A value that doesn't match its key's schema is replaced by the key's
  // default, as the server does for an invalid row.
  it("resolves hook results the same way as server defaults for missing branding", async () => {
    mockGet.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ primary_color: null, secondary_color: null }),
      }),
    );

    const keys = [
      OrganizationConfigKey.PrimaryColor,
      OrganizationConfigKey.SecondaryColor,
    ] as const;
    const { result } = renderHook(() => useOrganizationConfig(keys));

    await waitFor(() => {
      expect(result.current[OrganizationConfigKey.PrimaryColor]).toBe(
        DEFAULT_BRANDING[OrganizationConfigKey.PrimaryColor],
      );
      expect(result.current[OrganizationConfigKey.SecondaryColor]).toBe(
        DEFAULT_BRANDING[OrganizationConfigKey.SecondaryColor],
      );
      expect(result.current.status).toBe("ok");
    });

    expect(resolveBranding(result.current)).toEqual({
      [OrganizationConfigKey.PrimaryColor]:
        DEFAULT_BRANDING[OrganizationConfigKey.PrimaryColor],
      [OrganizationConfigKey.SecondaryColor]:
        DEFAULT_BRANDING[OrganizationConfigKey.SecondaryColor],
    });
  });

  it("keeps a configured primary color from the hook and defaults the secondary", async () => {
    mockGet.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            [OrganizationConfigKey.PrimaryColor]: "#000000",
          }),
      }),
    );

    const keys = [
      OrganizationConfigKey.PrimaryColor,
      OrganizationConfigKey.SecondaryColor,
    ] as const;
    const { result } = renderHook(() => useOrganizationConfig(keys));

    await waitFor(() => {
      expect(result.current[OrganizationConfigKey.PrimaryColor]).toBe(
        "#000000",
      );
      expect(result.current.status).toBe("ok");
    });

    expect(resolveBranding(result.current)).toEqual({
      [OrganizationConfigKey.PrimaryColor]: "#000000",
      [OrganizationConfigKey.SecondaryColor]:
        DEFAULT_BRANDING[OrganizationConfigKey.SecondaryColor],
    });
  });
  it("returns typed values, not strings", async () => {
    const footer = { email: "hello@example.com" };
    mockGet.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            [OrganizationConfigKey.FormsEnabled]: true,
            [OrganizationConfigKey.OrganizationFooter]: footer,
            [OrganizationConfigKey.LogoUrl]: null,
          }),
      }),
    );

    const keys = [
      OrganizationConfigKey.FormsEnabled,
      OrganizationConfigKey.OrganizationFooter,
      OrganizationConfigKey.LogoUrl,
    ] as const;
    const { result } = renderHook(() => useOrganizationConfig(keys));

    await waitFor(() => {
      expect(result.current[OrganizationConfigKey.FormsEnabled]).toBe(true);
    });
    const formsEnabled: boolean | undefined =
      result.current[OrganizationConfigKey.FormsEnabled];
    expect(formsEnabled).toBe(true);
    expect(result.current[OrganizationConfigKey.OrganizationFooter]).toEqual(
      footer,
    );
    expect(result.current[OrganizationConfigKey.LogoUrl]).toBeNull();
  });

  it("caches a public value that isn't a string", async () => {
    mockGet.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ [OrganizationConfigKey.LogoUrl]: null }),
      }),
    );

    const first = renderHook(() =>
      useOrganizationConfig([OrganizationConfigKey.LogoUrl]),
    );
    await waitFor(() => {
      expect(first.result.current[OrganizationConfigKey.LogoUrl]).toBeNull();
    });
    expect(mockGet).toHaveBeenCalledTimes(1);

    const second = renderHook(() =>
      useOrganizationConfig([OrganizationConfigKey.LogoUrl]),
    );
    await waitFor(() => {
      expect(second.result.current[OrganizationConfigKey.LogoUrl]).toBeNull();
    });
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("never reads or writes a restricted key in the cache", async () => {
    window.localStorage.setItem(
      "org-config:v3:acme:forms_enabled",
      JSON.stringify({ timestamp: Date.now(), value: true }),
    );
    mockGet.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            [OrganizationConfigKey.FormsEnabled]: false,
            [OrganizationConfigKey.Description]: "Admin only",
          }),
      }),
    );

    const keys = [
      OrganizationConfigKey.FormsEnabled,
      OrganizationConfigKey.Description,
    ] as const;
    const { result } = renderHook(() => useOrganizationConfig(keys));

    await waitFor(() => {
      expect(result.current[OrganizationConfigKey.FormsEnabled]).toBe(false);
    });
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0].query.keys).toEqual([...keys]);
    expect(
      window.localStorage.getItem("org-config:v3:acme:description"),
    ).toBeNull();
  });

  it("leaves out keys the server didn't return", async () => {
    mockGet.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ [OrganizationConfigKey.Tagline]: "Hello" }),
      }),
    );

    const keys = [
      OrganizationConfigKey.Tagline,
      OrganizationConfigKey.FormsEnabled,
    ] as const;
    const { result } = renderHook(() => useOrganizationConfig(keys));

    await waitFor(() => {
      expect(result.current[OrganizationConfigKey.Tagline]).toBe("Hello");
    });
    expect(result.current).not.toHaveProperty(
      OrganizationConfigKey.FormsEnabled,
    );
    expect(
      window.localStorage.getItem("org-config:v3:acme:forms_enabled"),
    ).toBeNull();
  });

  it("ignores entries cached in the old string format", async () => {
    window.localStorage.setItem(
      "org-config:v2:acme:forms_enabled",
      JSON.stringify({ timestamp: Date.now(), value: "true" }),
    );
    mockGet.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ [OrganizationConfigKey.FormsEnabled]: false }),
      }),
    );

    const { result } = renderHook(() =>
      useOrganizationConfig([OrganizationConfigKey.FormsEnabled]),
    );

    await waitFor(() => {
      expect(result.current[OrganizationConfigKey.FormsEnabled]).toBe(false);
    });
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
