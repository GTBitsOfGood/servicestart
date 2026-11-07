import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationType } from "@/core/db/schema";

const mocks = vi.hoisted(() => ({
  patch: vi.fn(),
  useNotifications: vi.fn(),
}));

vi.mock("@/core/api/client", () => ({
  default: {
    notifications: {
      ":id": { $patch: mocks.patch },
    },
  },
}));

vi.mock("@/features/communications/hooks/useNotifications", () => ({
  useNotifications: mocks.useNotifications,
}));

vi.mock("@/components/bog/BogIcon/BogIcon", () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
}));

import DashboardAlertBanner from "@/features/communications/components/DashboardAlertBanner";

function alert(id: string, text: string) {
  return {
    id,
    userId: "user_1",
    organizationId: "org_1",
    createdAt: "2026-11-02T12:00:00.000Z",
    read: false,
    type: NotificationType.Announcement,
    text,
  };
}

function notificationState(overrides: Record<string, unknown> = {}) {
  return {
    unreadNotifications: [
      alert("newest", "Weather update\nNewest camp alert"),
      alert("older", "Older camp alert"),
    ],
    isLoading: false,
    isRefreshing: false,
    errorMessage: null,
    refreshNotifications: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("DashboardAlertBanner", () => {
  beforeEach(() => {
    mocks.patch.mockResolvedValue({ ok: true });
    mocks.useNotifications.mockReturnValue(notificationState());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the unread announcement count and newest message", () => {
    render(<DashboardAlertBanner />);

    expect(mocks.useNotifications).toHaveBeenCalledWith(
      NotificationType.Announcement,
    );
    expect(screen.getByText("2 New Alert(s)")).toBeTruthy();
    expect(screen.getByText("Newest camp alert")).toBeTruthy();
    expect(screen.queryByText("Weather update")).toBeNull();
    expect(screen.queryByText("Older camp alert")).toBeNull();
  });

  it.each([{ isLoading: true }, { unreadNotifications: [] }])(
    "stays hidden without displayable alerts",
    (overrides) => {
      mocks.useNotifications.mockReturnValue(notificationState(overrides));

      render(<DashboardAlertBanner />);

      expect(
        screen.queryByRole("region", { name: "Dashboard alerts" }),
      ).toBeNull();
    },
  );

  it("shows a load error and lets the member retry", () => {
    const refreshNotifications = vi.fn().mockResolvedValue(undefined);
    mocks.useNotifications.mockReturnValue(
      notificationState({
        unreadNotifications: [],
        errorMessage: "Unable to load notifications.",
        refreshNotifications,
      }),
    );

    render(<DashboardAlertBanner />);

    expect(screen.getByText("Unable to load notifications.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refreshNotifications).toHaveBeenCalledTimes(1);
  });

  it("marks every displayed alert read, refreshes the shared count, and hides", async () => {
    const state = notificationState();
    mocks.useNotifications.mockReturnValue(state);

    render(<DashboardAlertBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss alerts" }));

    await waitFor(() => {
      expect(mocks.patch).toHaveBeenCalledTimes(2);
      expect(state.refreshNotifications).toHaveBeenCalledTimes(1);
    });
    expect(mocks.patch).toHaveBeenCalledWith({
      param: { id: "newest" },
      json: { read: true },
    });
    expect(mocks.patch).toHaveBeenCalledWith({
      param: { id: "older" },
      json: { read: true },
    });
    expect(
      screen.queryByRole("region", { name: "Dashboard alerts" }),
    ).toBeNull();
  });

  it("keeps the banner visible and reports a failed dismissal", async () => {
    mocks.patch.mockResolvedValue({ ok: false });

    render(<DashboardAlertBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss alerts" }));

    expect(
      await screen.findByText(
        "Could not dismiss the alerts. Please try again.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Dashboard alerts" }),
    ).toBeTruthy();
  });
});
