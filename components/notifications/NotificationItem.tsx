"use client";

import Link from "next/link";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { cn, formatTime } from "@/lib/utils";
import NotificationTag from "./NotificationTag";

export interface NotificationListItem {
  id: string;
  userId: string;
  organizationId: string;
  createdAt: string;
  read: boolean;
  type: string;
  text: string;
}

interface NotificationItemProps {
  notification: NotificationListItem;
  onDelete?: (id: string) => void;
  onToggleRead?: (id: string, read: boolean) => void;
  compact?: boolean;
}

export default function NotificationItem({
  notification,
  onDelete,
  onToggleRead,
  compact = false,
}: NotificationItemProps) {
  const title = notification.text.split("\n")[0];
  const body = notification.text.slice(notification.text.indexOf("\n") + 1);

  const showActions = !!onDelete || !!onToggleRead;

  const actionButtons = (
    <div className="flex items-center gap-1">
      {onDelete && (
        <button
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete(notification.id);
          }}
          className="rounded p-1 text-grey-icon-weak hover:bg-grey-fill-weak hover:text-grey-text-strong"
          title="Delete"
          type="button"
        >
          <BogIcon name="trash" size={compact ? 18 : 22} />
        </button>
      )}

      {onToggleRead && (
        <button
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleRead(notification.id, !notification.read);
          }}
          className="rounded p-1 text-grey-icon-weak hover:bg-grey-fill-weak hover:text-grey-text-strong"
          title={notification.read ? "Mark as unread" : "Mark as read"}
          type="button"
        >
          <BogIcon name="envelope" size={compact ? 18 : 22} />
        </button>
      )}
    </div>
  );

  if (compact) {
    return (
      <Link
        href={`/inbox/${notification.id}`}
        className="group block border-t border-grey-stroke-weak first:border-t-0"
      >
        <div
          className={cn(
            "relative flex flex-col gap-1.5 px-5 py-5 mobile:px-14 mobile:py-10 transition-colors hover:bg-grey-fill-weaker",
            !notification.read && "bg-notif-unread-bg",
          )}
        >
          {!notification.read && (
            <div
              className="absolute left-1.5 mobile:left-5 top-1/2 size-2 -translate-y-1/2 rounded-full bg-brand-text"
              aria-hidden
            />
          )}

          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-3">
              <NotificationTag type={notification.type} variant="text" />
              <div className="relative flex items-center">
                <span
                  className={cn(
                    "whitespace-nowrap text-paragraph-2 text-grey-text-weak transition-opacity",
                    showActions &&
                      "group-hover:opacity-0 group-focus-within:opacity-0",
                  )}
                >
                  {formatTime(notification.createdAt)}
                </span>

                {showActions && (
                  <div className="pointer-events-none absolute right-0 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                    {actionButtons}
                  </div>
                )}
              </div>
            </div>

            <p className="text-paragraph-1 font-semibold text-grey-text-strong">
              {title}
            </p>
          </div>

          <p className="line-clamp-2 text-paragraph-2 text-grey-text-weak">
            {body}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/inbox/${notification.id}`}
      className="group block border-t border-grey-stroke-weak first:border-t-0"
    >
      <div
        className={cn(
          "relative px-5 py-5 mobile:px-14 mobile:py-10 transition-colors hover:bg-grey-fill-weaker",
          !notification.read && "bg-notif-unread-bg",
        )}
      >
        {!notification.read && (
          <div
            className="absolute left-1.5 mobile:left-5 top-1/2 size-2 -translate-y-1/2 rounded-full bg-brand-text"
            aria-hidden
          />
        )}

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <NotificationTag type={notification.type} variant="light" />
            <div className="relative flex items-center">
              <span
                className={cn(
                  "whitespace-nowrap text-paragraph-2 text-grey-text-weak transition-opacity",
                  showActions &&
                    "group-hover:opacity-0 group-focus-within:opacity-0",
                )}
              >
                {formatTime(notification.createdAt)}
              </span>

              {showActions && (
                <div className="pointer-events-none absolute right-0 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                  {actionButtons}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-paragraph-1 font-semibold text-grey-text-strong">
              {title}
            </p>
            <p className="line-clamp-2 text-paragraph-2 text-grey-text-weak">
              {body}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
