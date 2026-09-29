import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationCounter from "@/components/navigation/NotificationCounter";

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
  default: () => null,
}));

describe("NotificationCounter", () => {
  beforeEach(() => {
    mockUseNotifications.mockReturnValue({
      allNotifications: [],
      unreadNotifications: [],
      unreadCount: 4,
      isLoading: false,
      isRefreshing: false,
      isMarkAllReadPending: false,
      errorMessage: null,
      refreshNotifications: vi.fn(),
      handleMarkAllRead: vi.fn(),
      handleDelete: vi.fn(),
      handleToggleRead: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("is accessible and opens the sidebar without changing location", () => {
    render(<NotificationCounter unreadCount={4} />);
    const originalUrl = window.location.href;

    const bell = screen.getByRole("button", { name: "Notifications" });
    expect(screen.getByText("4")).toBeTruthy();

    fireEvent.click(bell);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(window.location.href).toBe(originalUrl);
    expect(screen.getByRole("button", { name: "Unread (4)" })).toBeTruthy();
  });

  it("caps the displayed unread count at 99+", () => {
    render(<NotificationCounter unreadCount={105} />);
    expect(screen.getByText("99+")).toBeTruthy();
  });
});
