import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VerticalIconNav } from "@/components/navigation/VerticalIconNav";
import { VerticalSidebarNav } from "@/components/navigation/VerticalSidebarNav";
import type { NavbarItem } from "@/lib/navbar";

const { mockUseNotifications } = vi.hoisted(() => ({
  mockUseNotifications: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/lib/hooks/useUnreadNotificationCount", () => ({
  useUnreadNotificationCount: () => ({ count: 3, isLoading: false }),
}));

vi.mock("@/lib/hooks/useNotifications", () => ({
  useNotifications: mockUseNotifications,
}));

vi.mock("@/components/bog/BogIcon/BogIcon", () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("@/components/navigation/Logo", () => ({
  SunsetLogo: () => <span>Logo</span>,
}));

vi.mock("@/components/navigation/ProfileAvatar", () => ({
  ProfileAvatar: () => <span>Profile</span>,
}));

vi.mock("@/components/navigation/UserProfileMenu", () => ({
  UserProfileMenu: () => <span>Profile menu</span>,
}));

vi.mock("@/components/notifications/NotificationItem", () => ({
  default: () => null,
}));

const items: NavbarItem[] = [
  { label: "Home", href: "/", icon: "house" },
  { label: "Inbox", href: "/inbox", icon: "bell" },
];

describe("vertical notification navigation", () => {
  beforeEach(() => {
    mockUseNotifications.mockReturnValue({
      allNotifications: [],
      unreadNotifications: [],
      unreadCount: 3,
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

  it.each([
    ["icon", <VerticalIconNav key="icon" items={items} />],
    ["sidebar", <VerticalSidebarNav key="sidebar" items={items} />],
  ])("opens the sidebar from the %s layout without navigating", (_, nav) => {
    render(nav);
    const originalUrl = window.location.href;

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(window.location.href).toBe(originalUrl);
    expect(screen.getByRole("button", { name: "Unread (3)" })).toBeTruthy();
  });
});
