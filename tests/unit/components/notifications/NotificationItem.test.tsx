import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotificationItem, {
  type NotificationListItem,
} from "@/components/notifications/NotificationItem";
import { JoinRequestStatus } from "@/lib/schema";

vi.mock("@/components/bog/BogIcon/BogIcon", () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("@/components/bog/BogModal/BogModal", () => ({
  default: () => null,
}));

function buildNotification(
  overrides: Partial<NotificationListItem> = {},
): NotificationListItem {
  return {
    id: "notification-1",
    userId: "user-1",
    organizationId: "org-1",
    createdAt: new Date().toISOString(),
    read: false,
    type: "general",
    text: "Dues reminder\nDues are due at the end of the month.",
    ...overrides,
  };
}

function unreadDots(container: HTMLElement) {
  return container.querySelectorAll('[aria-hidden="true"].bg-brand-text');
}

function unreadBackgrounds(container: HTMLElement) {
  return container.querySelectorAll(".bg-notif-unread-bg");
}

afterEach(cleanup);

describe("NotificationItem unread indicator", () => {
  it("renders one dot and one highlighted row for an unread inbox item", () => {
    const { container } = render(
      <NotificationItem notification={buildNotification()} />,
    );

    expect(unreadDots(container)).toHaveLength(1);
    expect(unreadBackgrounds(container)).toHaveLength(1);
  });

  it("renders no dot for a read inbox item", () => {
    const { container } = render(
      <NotificationItem notification={buildNotification({ read: true })} />,
    );

    expect(unreadDots(container)).toHaveLength(0);
    expect(unreadBackgrounds(container)).toHaveLength(0);
  });

  it("renders one dot for an unread join request", () => {
    const { container } = render(
      <NotificationItem
        notification={buildNotification({ type: "action_required" })}
        joinRequest={{
          status: JoinRequestStatus.Pending,
          user: { id: "user-2", name: "Pat", email: "pat@example.com" },
          organization: "ServiceStart",
        }}
      />,
    );

    expect(unreadDots(container)).toHaveLength(1);
  });

  it("renders one dot for an unread compact item", () => {
    const { container } = render(
      <NotificationItem notification={buildNotification()} compact />,
    );

    expect(unreadDots(container)).toHaveLength(1);
  });
});
