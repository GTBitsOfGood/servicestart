export const UNREAD_NOTIFICATION_COUNT_CHANGED =
  "notifications:unread-count-changed";

export type UnreadNotificationCountChangedDetail = {
  count: number;
  organizationId: string;
};

export function publishUnreadNotificationCount(
  count: number,
  organizationId: string,
) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<UnreadNotificationCountChangedDetail>(
      UNREAD_NOTIFICATION_COUNT_CHANGED,
      { detail: { count, organizationId } },
    ),
  );
}
