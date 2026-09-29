import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationListItem } from "@/components/notifications/NotificationItem";
import { useNotifications } from "@/lib/hooks/useNotifications";

const mocks = vi.hoisted(() => ({
  activeOrganizationId: "org-a",
  fetchNotifications: vi.fn(),
  fetchUnreadCount: vi.fn(),
  publishUnreadNotificationCount: vi.fn(),
}));

vi.mock("@/lib/authClient", () => ({
  default: {
    useSession: () => ({ data: { user: { id: "user-1" } } }),
    useActiveOrganization: () => ({
      data: { id: mocks.activeOrganizationId },
    }),
  },
}));

vi.mock("@/lib/notifications", () => ({
  fetchNotifications: mocks.fetchNotifications,
  fetchUnreadCount: mocks.fetchUnreadCount,
}));

vi.mock("@/lib/notificationEvents", () => ({
  publishUnreadNotificationCount: mocks.publishUnreadNotificationCount,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function notification(
  id: string,
  organizationId: string,
): NotificationListItem {
  return {
    id,
    userId: "user-1",
    organizationId,
    createdAt: "2026-09-26T12:00:00.000Z",
    read: false,
    type: "general",
    text: `Notification for ${organizationId}`,
  };
}

describe("useNotifications", () => {
  beforeEach(() => {
    mocks.activeOrganizationId = "org-a";
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("ignores results from the previously active organization", async () => {
    const orgAAll = deferred<NotificationListItem[]>();
    const orgAUnread = deferred<NotificationListItem[]>();
    const orgACount = deferred<number>();
    const orgBAll = deferred<NotificationListItem[]>();
    const orgBUnread = deferred<NotificationListItem[]>();
    const orgBCount = deferred<number>();

    mocks.fetchNotifications
      .mockReturnValueOnce(orgAAll.promise)
      .mockReturnValueOnce(orgAUnread.promise)
      .mockReturnValueOnce(orgBAll.promise)
      .mockReturnValueOnce(orgBUnread.promise);
    mocks.fetchUnreadCount
      .mockReturnValueOnce(orgACount.promise)
      .mockReturnValueOnce(orgBCount.promise);

    const { result, rerender } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(mocks.fetchNotifications).toHaveBeenCalledTimes(2);
      expect(mocks.fetchUnreadCount).toHaveBeenCalledTimes(1);
    });

    mocks.activeOrganizationId = "org-b";
    rerender();

    await waitFor(() => {
      expect(mocks.fetchNotifications).toHaveBeenCalledTimes(4);
      expect(mocks.fetchUnreadCount).toHaveBeenCalledTimes(2);
    });

    const orgBNotification = notification("notification-b", "org-b");
    await act(async () => {
      orgBAll.resolve([orgBNotification]);
      orgBUnread.resolve([orgBNotification]);
      orgBCount.resolve(1);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.allNotifications).toEqual([orgBNotification]);
      expect(result.current.unreadNotifications).toEqual([orgBNotification]);
      expect(result.current.unreadCount).toBe(1);
    });

    const orgANotification = notification("notification-a", "org-a");
    await act(async () => {
      orgAAll.resolve([orgANotification]);
      orgAUnread.resolve([orgANotification]);
      orgACount.resolve(1);
      await Promise.resolve();
    });

    expect(result.current.allNotifications).toEqual([orgBNotification]);
    expect(result.current.unreadNotifications).toEqual([orgBNotification]);
    expect(result.current.unreadCount).toBe(1);
    expect(mocks.publishUnreadNotificationCount).toHaveBeenCalledTimes(1);
    expect(mocks.publishUnreadNotificationCount).toHaveBeenCalledWith(
      1,
      "org-b",
    );
  });
});
