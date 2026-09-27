import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUnreadNotificationCount } from "@/lib/hooks/useUnreadNotificationCount";
import { publishUnreadNotificationCount } from "@/lib/notificationEvents";

const { mockGetUnreadCount } = vi.hoisted(() => ({
  mockGetUnreadCount: vi.fn(),
}));

vi.mock("@/lib/authClient", () => ({
  default: {
    useSession: () => ({ data: { user: { id: "user-1" } } }),
    useActiveOrganization: () => ({ data: { id: "org-1" } }),
  },
}));

vi.mock("@/lib/api", () => ({
  default: {
    notifications: {
      unreadCount: { $get: mockGetUnreadCount },
    },
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

describe("useUnreadNotificationCount", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps the bell count synchronized for the active organization", async () => {
    mockGetUnreadCount.mockResolvedValue({
      ok: true,
      json: async () => ({ count: 4 }),
    });

    const { result } = renderHook(() => useUnreadNotificationCount());
    await waitFor(() => expect(result.current.count).toBe(4));

    act(() => publishUnreadNotificationCount(2, "org-1"));
    expect(result.current.count).toBe(2);

    act(() => publishUnreadNotificationCount(9, "another-org"));
    expect(result.current.count).toBe(2);
  });

  it("does not let an older request replace a newer published count", async () => {
    const response = deferred<{
      ok: true;
      json: () => Promise<{ count: number }>;
    }>();
    mockGetUnreadCount.mockReturnValue(response.promise);

    const { result } = renderHook(() => useUnreadNotificationCount());
    await waitFor(() => expect(mockGetUnreadCount).toHaveBeenCalledOnce());

    act(() => publishUnreadNotificationCount(2, "org-1"));
    expect(result.current.count).toBe(2);
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      response.resolve({
        ok: true,
        json: async () => ({ count: 4 }),
      });
      await response.promise;
      await Promise.resolve();
    });

    expect(result.current.count).toBe(2);
    expect(result.current.isLoading).toBe(false);
  });
});
