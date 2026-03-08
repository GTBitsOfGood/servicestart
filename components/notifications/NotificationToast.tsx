"use client";

import Link from "next/link";
import { Toast } from "radix-ui";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { NotificationType } from "@/lib/schema";
import { formatTime } from "@/lib/utils";
import api from "@/lib/api";
import type { NotificationListItem } from "./NotificationItem";
import NotificationTag from "./NotificationTag";

const ACTION_TYPES = new Set<string>([
  NotificationType.ActionRequired,
  NotificationType.Members,
]);

interface NotificationToastProps {
  notification: NotificationListItem;
  onDismiss: (id: string) => void;
}

function getCtaLabel(type: string) {
  switch (type) {
    case NotificationType.Members:
      return "View Profile";
    case NotificationType.ActionRequired:
      return "Take Action";
    case NotificationType.Announcement:
      return "View announcement";
    default:
      return "View";
  }
}

function markAsRead(id: string) {
  void api.notifications[":id"].$patch({
    param: { id },
    json: { read: true },
  });
}

export default function NotificationToast({
  notification,
  onDismiss,
}: NotificationToastProps) {
  const title = notification.text.split("\n")[0];
  const body = notification.text;
  const isActionType = ACTION_TYPES.has(notification.type);
  const ctaLabel = getCtaLabel(notification.type);

  return (
    <Toast.Root
      duration={8000}
      onOpenChange={(open) => {
        if (!open) onDismiss(notification.id);
      }}
      className="grid w-full grid-cols-[1fr_auto] items-start gap-x-4 rounded-lg border border-grey-stroke-weak bg-white p-6 shadow-xl data-[state=open]:animate-slide-in-right data-[state=closed]:animate-fade-out data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=end]:animate-slide-out-right"
    >
      <div className="col-span-2 flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <NotificationTag type={notification.type} variant="text" />
            <div className="flex items-center gap-3">
              <span className="whitespace-nowrap text-paragraph-2 text-grey-text-weak">
                {formatTime(notification.createdAt)}
              </span>
              <Toast.Close asChild>
                <button
                  type="button"
                  className="rounded p-0.5 text-grey-icon-weak hover:text-grey-text-strong"
                  aria-label="Dismiss notification"
                >
                  <BogIcon name="x" size={20} />
                </button>
              </Toast.Close>
            </div>
          </div>

          <Toast.Title className="text-paragraph-1 font-semibold text-grey-text-strong">
            {title}
          </Toast.Title>
        </div>

        <Toast.Description className="line-clamp-2 text-paragraph-2 text-grey-text-weak">
          {body}
        </Toast.Description>
      </div>

      <div className="col-span-2 mt-2">
        {isActionType ? (
          <Toast.Action altText={ctaLabel} asChild>
            <Link
              href={`/inbox/${notification.id}`}
              onClick={() => markAsRead(notification.id)}
              className="inline-flex items-center rounded bg-brand-text px-3 py-2 text-paragraph-2 font-semibold text-white hover:opacity-90"
            >
              {ctaLabel}
            </Link>
          </Toast.Action>
        ) : (
          <Toast.Action altText={ctaLabel} asChild>
            <Link
              href={`/inbox/${notification.id}`}
              onClick={() => markAsRead(notification.id)}
              className="inline-flex items-center gap-1 text-paragraph-2 font-semibold text-brand-text hover:opacity-80"
            >
              {ctaLabel}
              <BogIcon name="arrow-right" size={20} />
            </Link>
          </Toast.Action>
        )}
      </div>
    </Toast.Root>
  );
}
