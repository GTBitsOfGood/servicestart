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

const ROOT_DOMAIN = "servicestart.com";
vi.mock("@/lib/utils", () => ({
  getSlugFromHostname: vi.fn((hostname: string) => {
    if (hostname === ROOT_DOMAIN) return "servicestart";
    if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
      const sub = hostname.slice(0, -ROOT_DOMAIN.length - 1);
      return sub || "servicestart";
    }
    return "servicestart";
  }),
}));

describe("useOrganizationConfig", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.mock("@/lib/api", () => ({
      default: {
        organizationConfig: {
          $get: (args: {
            query: { keys: string[]; organizationSlug: string };
          }) => {
            if (
              args.query.organizationSlug !== "acme" &&
              args.query.organizationSlug !== "servicestart"
            ) {
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
          },
        },
      },
    }));

    const { result } = renderHook(() =>
      useOrganizationConfig([OrganizationConfigKey.Description]),
    );

    await waitFor(() => {
      expect(result.current[OrganizationConfigKey.Description]).toBe("value1");
    });
  });
});
