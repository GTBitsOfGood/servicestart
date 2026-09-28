import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationsSidebar from "@/components/notifications/NotificationsSidebar";

const { mockUseNotifications } = vi.hoisted(() => ({
  mockUseNotifications: vi.fn(),
}));

vi.mock("@/lib/hooks/useNotifications", () => ({
  useNotifications: mockUseNotifications,
}));

vi.mock("@/components/bog/BogIcon/BogIcon", () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("@/components/notifications/NotificationItem", () => ({
  default: ({
    notification,
    onToggleRead,
  }: {
    notification: { id: string; text: string; read: boolean };
    onToggleRead: (id: string, read: boolean) => void;
  }) => (
    <div>
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

const allNotifications = [
  { id: "unread", text: "Unread message", read: false },
  { id: "read", text: "Read message", read: true },
];
const unreadNotifications = [allNotifications[0]];

function notificationState(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    allNotifications,
    unreadNotifications,
    unreadCount: 1,
    isLoading: false,
    isRefreshing: false,
    isMarkAllReadPending: false,
    errorMessage: null,
    refreshNotifications: vi.fn(),
    handleMarkAllRead: vi.fn(),
    handleDelete: vi.fn(),
    handleToggleRead: vi.fn(),
    ...overrides,
  };
}

function renderSidebar() {
  render(
    <NotificationsSidebar
      trigger={
        <button type="button" aria-label="Notifications">
          Open notifications
        </button>
      }
    />,
  );
}

function openSidebar() {
  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
}

describe("NotificationsSidebar", () => {
  beforeEach(() => {
    mockUseNotifications.mockReturnValue(notificationState());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("opens from the trigger and closes with the close button", async () => {
    renderSidebar();
    const trigger = screen.getByRole("button", { name: "Notifications" });

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Close notifications" }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("closes with Escape and restores focus to the trigger", async () => {
    renderSidebar();
    const trigger = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(trigger);

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("closes when the user clicks outside the sidebar", async () => {
    renderSidebar();
    openSidebar();

    const overlay = screen.getByTestId("notifications-sidebar-overlay");
    fireEvent.pointerDown(overlay, { button: 0, ctrlKey: false });
    fireEvent.click(overlay);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("links to the full inbox and closes when followed", async () => {
    renderSidebar();
    openSidebar();

    const link = screen.getByRole("link", { name: "View full inbox" });
    expect(link.getAttribute("href")).toBe("/inbox");

    fireEvent.click(link);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("switches between All and Unread notifications", () => {
    renderSidebar();
    openSidebar();

    expect(screen.getByText("Unread message")).toBeTruthy();
    expect(screen.getByText("Read message")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Unread (1)" }));

    expect(screen.getByText("Unread message")).toBeTruthy();
    expect(screen.queryByText("Read message")).toBeNull();
  });

  it("supports marking one notification and all notifications read", () => {
    const handleToggleRead = vi.fn();
    const handleMarkAllRead = vi.fn();
    mockUseNotifications.mockReturnValue(
      notificationState({ handleToggleRead, handleMarkAllRead }),
    );
    renderSidebar();
    openSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Toggle unread" }));
    expect(handleToggleRead).toHaveBeenCalledWith("unread", true);

    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(handleMarkAllRead).toHaveBeenCalledOnce();
  });

  it("shows the loading and empty states", () => {
    mockUseNotifications.mockReturnValue(
      notificationState({ isLoading: true }),
    );
    const { unmount } = render(
      <NotificationsSidebar trigger={<button>Notifications</button>} />,
    );
    openSidebar();
    expect(
      screen.getByRole("status", { name: "Loading notifications" }),
    ).toBeTruthy();

    unmount();
    mockUseNotifications.mockReturnValue(
      notificationState({
        allNotifications: [],
        unreadNotifications: [],
        unreadCount: 0,
      }),
    );
    renderSidebar();
    openSidebar();
    expect(screen.getByText("No notifications yet.")).toBeTruthy();
  });

  it("shows an error and retries loading", () => {
    const refreshNotifications = vi.fn();
    mockUseNotifications.mockReturnValue(
      notificationState({
        errorMessage: "Unable to load notifications.",
        refreshNotifications,
      }),
    );
    renderSidebar();
    openSidebar();

    expect(screen.getByText("Failed to load")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refreshNotifications).toHaveBeenCalledOnce();
  });
});
