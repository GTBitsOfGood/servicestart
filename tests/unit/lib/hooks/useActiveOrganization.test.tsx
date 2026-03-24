// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";

const mockSetActive = vi.fn();
const mockUseSession = vi.fn();
const mockUseActiveOrganization = vi.fn();

vi.mock("@/lib/authClient", () => ({
  default: {
    useSession: () => mockUseSession(),
    useActiveOrganization: () => mockUseActiveOrganization(),
    organization: {
      setActive: (args: { organizationSlug: string }) => mockSetActive(args),
    },
  },
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

describe("useActiveOrganization", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetActive.mockResolvedValue(undefined);
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, hostname: "acme.servicestart.com" },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });
  });

  it("returns slug from hostname and organization from useActiveOrganization", () => {
    mockUseSession.mockReturnValue({ data: null });
    mockUseActiveOrganization.mockReturnValue({
      data: null,
      error: null,
      isPending: false,
      isRefetching: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useActiveOrganization());

    expect(result.current.slug).toBe("acme");
    expect(result.current.organization).toEqual({
      data: null,
      error: null,
      isPending: false,
      isRefetching: false,
      refetch: expect.any(Function),
    });
  });

  it("returns default slug for servicestart.com hostname", () => {
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, hostname: "servicestart.com" },
      writable: true,
    });
    mockUseSession.mockReturnValue({ data: null });
    mockUseActiveOrganization.mockReturnValue({
      data: null,
      error: null,
      isPending: false,
      isRefetching: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useActiveOrganization());

    expect(result.current.slug).toBe("servicestart");
  });

  it("returns slug when user is not signed in", () => {
    mockUseSession.mockReturnValue({ data: null });
    mockUseActiveOrganization.mockReturnValue({
      data: null,
      error: null,
      isPending: false,
      isRefetching: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useActiveOrganization());

    expect(result.current.slug).toBe("acme");
    expect(mockSetActive).not.toHaveBeenCalled();
  });

  it("calls setActive when session exists and active org slug does not match URL slug", async () => {
    mockUseSession.mockReturnValue({ data: { user: {}, session: {} } });
    mockUseActiveOrganization.mockReturnValue({
      data: { slug: "other", id: "org_other", name: "Other" },
      error: null,
      isPending: false,
      isRefetching: false,
      refetch: vi.fn(),
    });

    renderHook(() => useActiveOrganization());

    await waitFor(() => {
      expect(mockSetActive).toHaveBeenCalledWith({ organizationSlug: "acme" });
    });
  });

  it("does not call setActive when session exists and active org slug matches URL slug", async () => {
    mockUseSession.mockReturnValue({ data: { user: {}, session: {} } });
    mockUseActiveOrganization.mockReturnValue({
      data: { slug: "acme", id: "org_acme", name: "Acme" },
      error: null,
      isPending: false,
      isRefetching: false,
      refetch: vi.fn(),
    });

    renderHook(() => useActiveOrganization());

    await waitFor(() => {});

    expect(mockSetActive).not.toHaveBeenCalled();
  });

  it("does not call setActive when there is no session", async () => {
    mockUseSession.mockReturnValue({ data: null });
    mockUseActiveOrganization.mockReturnValue({
      data: null,
      error: null,
      isPending: false,
      isRefetching: false,
      refetch: vi.fn(),
    });

    renderHook(() => useActiveOrganization());

    await waitFor(() => {});

    expect(mockSetActive).not.toHaveBeenCalled();
  });
});
