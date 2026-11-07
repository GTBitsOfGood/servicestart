// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useActiveOrganization } from "@/core/tenant/hooks/useActiveOrganization";

const mockSetActive = vi.fn();
const mockUseSession = vi.fn();
const mockUseActiveOrganization = vi.fn();

vi.mock("@/core/auth/authClient", () => ({
  default: {
    useSession: () => mockUseSession(),
    useActiveOrganization: () => mockUseActiveOrganization(),
    organization: {
      setActive: (args: { organizationSlug: string }) => mockSetActive(args),
    },
  },
}));

describe("useActiveOrganization", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_TENANT_ROOT_DOMAIN", "servicestart.com");
    mockSetActive.mockResolvedValue(undefined);
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, hostname: "acme.servicestart.com" },
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it("returns no slug on the default host without an active organization", () => {
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

    expect(result.current.slug).toBeNull();
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

  it("does not call setActive on loopback for any browser", async () => {
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, hostname: "localhost" },
      writable: true,
    });
    vi.stubGlobal("navigator", { ...navigator, webdriver: true });

    mockUseSession.mockReturnValue({ data: { user: {}, session: {} } });
    mockUseActiveOrganization.mockReturnValue({
      data: { slug: "other", id: "org_other", name: "Other" },
      error: null,
      isPending: false,
      isRefetching: false,
      refetch: vi.fn(),
    });

    renderHook(() => useActiveOrganization());

    await waitFor(() => {});

    expect(mockSetActive).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("does not call setActive when session exists and active org slug matches URL slug", async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {},
        session: { activeOrganizationId: "org_acme" },
      },
    });
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

  it("calls setActive when cached organization matches but the new session has no active organization", async () => {
    mockUseSession.mockReturnValue({
      data: { user: {}, session: { activeOrganizationId: null } },
    });
    mockUseActiveOrganization.mockReturnValue({
      data: { slug: "acme", id: "org_acme", name: "Acme" },
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
  it("uses the session org on a default host without synchronizing to a slug", () => {
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, hostname: "localhost" },
      writable: true,
    });
    mockUseSession.mockReturnValue({
      data: { session: { activeOrganizationId: "org_other" } },
    });
    mockUseActiveOrganization.mockReturnValue({
      data: { id: "org_other", slug: "other" },
    });
    const { result } = renderHook(() => useActiveOrganization());
    expect(result.current.slug).toBe("other");
    expect(result.current.organization.data?.id).toBe("org_other");
    expect(mockSetActive).not.toHaveBeenCalled();
  });

  it("withholds cached organization data for a different tenant", () => {
    mockUseSession.mockReturnValue({
      data: { session: { activeOrganizationId: "org_other" } },
    });
    mockUseActiveOrganization.mockReturnValue({
      data: { id: "org_other", slug: "other" },
    });
    const { result } = renderHook(() => useActiveOrganization());
    expect(result.current.slug).toBe("acme");
    expect(result.current.organization.data).toBeNull();
  });
});
