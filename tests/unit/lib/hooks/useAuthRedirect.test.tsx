// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useRedirectIfNotAdmin,
  useRedirectIfNotMember,
} from "@/lib/hooks/useAuthRedirect";
import { JoinRequestStatus } from "@/lib/schema";

const mockReplace = vi.fn();
const mockUseSession = vi.fn();
const mockUseActiveOrganization = vi.fn();
const mockJoinRequestGet = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

vi.mock("@/lib/authClient", () => ({
  default: {
    useSession: () => mockUseSession(),
  },
}));

vi.mock("@/lib/hooks/useActiveOrganization", () => ({
  useActiveOrganization: () => ({
    organization: mockUseActiveOrganization(),
  }),
}));

vi.mock("@/lib/api", () => ({
  default: {
    joinRequests: {
      ":organizationId": {
        $get: (args: { param: { organizationId: string } }) =>
          mockJoinRequestGet(args),
      },
    },
  },
}));

function buildSession({
  userId = "user-1",
  activeOrganizationId,
}: {
  userId?: string;
  activeOrganizationId?: string | null;
} = {}) {
  return {
    data: {
      user: { id: userId, email: "test@example.com" },
      session: {
        activeOrganizationId: activeOrganizationId ?? null,
      },
    },
    isPending: false,
  };
}

function buildOrganization({
  id,
  members,
  role,
}: {
  id?: string | null;
  members?: Array<{ userId: string; role: "owner" | "admin" | "member" }>;
  role?: string;
} = {}) {
  return {
    data: id
      ? {
          id,
          slug: "acme",
          members: members ?? [],
          ...(role ? { role } : {}),
        }
      : null,
    isPending: false,
    isRefetching: false,
    error: null,
    refetch: vi.fn(),
  };
}

describe("useAuthRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJoinRequestGet.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve(null),
    });
  });

  it("redirects unauthenticated users to /login", async () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false });
    mockUseActiveOrganization.mockReturnValue(buildOrganization());

    renderHook(() => useRedirectIfNotMember());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });
  });

  it("redirects users with pending join requests to /joinrequeststatus", async () => {
    mockUseSession.mockReturnValue(
      buildSession({ activeOrganizationId: "org-1" }),
    );
    mockUseActiveOrganization.mockReturnValue(buildOrganization());
    mockJoinRequestGet.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: JoinRequestStatus.Pending,
        }),
    });

    renderHook(() => useRedirectIfNotMember());

    await waitFor(() => {
      expect(mockJoinRequestGet).toHaveBeenCalledWith({
        param: { organizationId: "org-1" },
      });
      expect(mockReplace).toHaveBeenCalledWith("/joinrequeststatus");
    });
  });

  it("redirects authenticated non-admin users to / for admin-only access", async () => {
    mockUseSession.mockReturnValue(
      buildSession({ activeOrganizationId: "org-1" }),
    );
    mockUseActiveOrganization.mockReturnValue(
      buildOrganization({
        id: "org-1",
        members: [{ userId: "user-1", role: "member" }],
      }),
    );

    renderHook(() => useRedirectIfNotAdmin());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });

  it("allows authenticated members through without redirect", async () => {
    mockUseSession.mockReturnValue(
      buildSession({ activeOrganizationId: "org-1" }),
    );
    mockUseActiveOrganization.mockReturnValue(
      buildOrganization({
        id: "org-1",
        members: [{ userId: "user-1", role: "member" }],
      }),
    );

    const { result } = renderHook(() => useRedirectIfNotMember());

    await waitFor(() => {
      expect(result.current.canAccess).toBe(true);
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("allows admins through without redirect", async () => {
    mockUseSession.mockReturnValue(
      buildSession({ activeOrganizationId: "org-1" }),
    );
    mockUseActiveOrganization.mockReturnValue(
      buildOrganization({
        id: "org-1",
        members: [{ userId: "user-1", role: "owner" }],
      }),
    );

    const { result } = renderHook(() => useRedirectIfNotAdmin());

    await waitFor(() => {
      expect(result.current.canAccess).toBe(true);
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("treats organization data without a matching member entry as not having membership", async () => {
    mockUseSession.mockReturnValue(
      buildSession({ activeOrganizationId: "org-1" }),
    );
    mockUseActiveOrganization.mockReturnValue(
      buildOrganization({
        id: "org-1",
        members: [{ userId: "other-user", role: "admin" }],
      }),
    );
    mockJoinRequestGet.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve(null),
    });

    renderHook(() => useRedirectIfNotMember());

    await waitFor(() => {
      expect(mockJoinRequestGet).toHaveBeenCalledWith({
        param: { organizationId: "org-1" },
      });
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });

  it("does not leak join request state across org changes", async () => {
    let currentSession = buildSession({ activeOrganizationId: "org-1" });
    let currentOrganization = buildOrganization();

    mockUseSession.mockImplementation(() => currentSession);
    mockUseActiveOrganization.mockImplementation(() => currentOrganization);
    mockJoinRequestGet
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: JoinRequestStatus.Pending,
          }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(null),
      });

    const { rerender } = renderHook(() => useRedirectIfNotMember());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/joinrequeststatus");
    });

    vi.clearAllMocks();

    currentSession = buildSession({
      userId: "user-2",
      activeOrganizationId: "org-2",
    });
    currentOrganization = buildOrganization();
    rerender();

    await waitFor(() => {
      expect(mockJoinRequestGet).toHaveBeenCalledWith({
        param: { organizationId: "org-2" },
      });
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });
});
