import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationsDashboardWidget from "@/components/dashboard/widgets/NotificationsWidget";

const { mockUseNotifications, mockUseUnreadNotificationCount } = vi.hoisted(
  () => ({
    mockUseNotifications: vi.fn(),
    mockUseUnreadNotificationCount: vi.fn(),
  }),
);

vi.mock("@/lib/hooks/useNotifications", () => ({
  useNotifications: mockUseNotifications,
}));

vi.mock("@/lib/hooks/useUnreadNotificationCount", () => ({
  useUnreadNotificationCount: mockUseUnreadNotificationCount,
}));

vi.mock("@/components/notifications/NotificationItem", () => ({
  default: ({
    notification,
    onToggleRead,
  }: {
    notification: { id: string; text: string; read: boolean };
    onToggleRead: (id: string, read: boolean) => void;
  }) => (
    <div data-testid="notification-item">
      <span>{notification.text}</span>
      <button
        type="button"
        onClick={() => onToggleRead(notification.id, !notification.read)}
      >
        Toggle {notification.id}
      </button>
    </div>
  ),
}));

function unread(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    text: `Unread ${i}`,
    read: false,
  }));
}

function notificationState(overrides: Record<string, unknown> = {}) {
  const unreadNotifications = unread(2);
  return {
    unreadNotifications,
    unreadCount: unreadNotifications.length,
    isLoading: false,
    errorMessage: null,
    refreshNotifications: vi.fn(),
    handleToggleRead: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockUseUnreadNotificationCount.mockReturnValue({
    count: 2,
    isLoading: false,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("NotificationsDashboardWidget", () => {
  it("lists unread notifications with the count and a link to the inbox", () => {
    mockUseNotifications.mockReturnValue(notificationState());

    render(<NotificationsDashboardWidget />);

    expect(screen.getByText("Unread 0")).toBeTruthy();
    expect(screen.getByText("Unread 1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "View all" }).getAttribute("href"),
    ).toBe("/inbox");
    expect(screen.queryByText("No new notifications")).toBeNull();
  });

  it("shows at most five notifications", () => {
    const unreadNotifications = unread(7);
    mockUseNotifications.mockReturnValue(
      notificationState({ unreadNotifications, unreadCount: 7 }),
    );
    mockUseUnreadNotificationCount.mockReturnValue({
      count: 7,
      isLoading: false,
    });

    render(<NotificationsDashboardWidget />);

    expect(screen.getAllByTestId("notification-item")).toHaveLength(5);
  });

  it("shows the empty state when nothing is unread", () => {
    mockUseNotifications.mockReturnValue(
      notificationState({ unreadNotifications: [], unreadCount: 0 }),
    );
    mockUseUnreadNotificationCount.mockReturnValue({
      count: 0,
      isLoading: false,
    });

    render(<NotificationsDashboardWidget />);

    expect(screen.getByText("No new notifications")).toBeTruthy();
  });

  it("marks a notification read through the shared hook", () => {
    const state = notificationState();
    mockUseNotifications.mockReturnValue(state);

    render(<NotificationsDashboardWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle n0" }));

    expect(state.handleToggleRead).toHaveBeenCalledWith("n0", true);
  });

  it("offers a retry when loading fails", () => {
    const state = notificationState({
      unreadNotifications: [],
      errorMessage: "Unable to load notifications.",
    });
    mockUseNotifications.mockReturnValue(state);

    render(<NotificationsDashboardWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.getByText("Unable to load notifications.")).toBeTruthy();
    expect(state.refreshNotifications).toHaveBeenCalledTimes(1);
  });

  it("reloads when the unread count changes elsewhere", () => {
    const state = notificationState();
    mockUseNotifications.mockReturnValue(state);
    mockUseUnreadNotificationCount.mockReturnValue({
      count: 1,
      isLoading: false,
    });

    render(<NotificationsDashboardWidget />);

    expect(state.refreshNotifications).toHaveBeenCalledTimes(1);
  });

  it("does not reload while its own load is in flight", () => {
    const state = notificationState({
      unreadNotifications: [],
      unreadCount: 0,
      isLoading: true,
    });
    mockUseNotifications.mockReturnValue(state);

    render(<NotificationsDashboardWidget />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(state.refreshNotifications).not.toHaveBeenCalled();
  });
});
