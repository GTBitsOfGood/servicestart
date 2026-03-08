"use client";

import Link from "next/link";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { cn } from "@/lib/utils";
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

function formatTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} mins ago`;
  if (diffHours < 24) return `${diffHours} hrs ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  const body = notification.text;

  const showActions = !!onDelete || !!onToggleRead;

  const actionButtons = (
    <div className="flex items-center gap-[4px]">
      {onDelete && (
        <button
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete(notification.id);
          }}
          className="rounded-[4px] p-[4px] text-grey-icon-weak hover:bg-grey-fill-weak hover:text-grey-text-strong"
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
          className="rounded-[4px] p-[4px] text-grey-icon-weak hover:bg-grey-fill-weak hover:text-grey-text-strong"
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
            "relative flex flex-col gap-[6px] px-[36px] py-[24px] transition-colors hover:bg-grey-fill-weaker",
            !notification.read && "bg-notif-unread-bg",
          )}
        >
          {!notification.read && (
            <div
              className="absolute h-[8px] w-[8px] rounded-full bg-brand-text"
              style={{ left: "17px", top: "63px" }}
              aria-hidden
            />
          )}

          <div className="flex flex-col gap-[2px]">
            <div className="flex items-center justify-between gap-[12px]">
              <NotificationTag type={notification.type} variant="text" />
              <div className="relative flex items-center">
                <span
                  className={cn(
                    "whitespace-nowrap text-[16px] text-grey-text-weak transition-opacity",
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

            <p className="text-[18px] font-semibold leading-[25px] text-grey-text-strong">
              {title}
            </p>
          </div>

          <p className="line-clamp-2 text-[16px] leading-[22px] text-grey-text-weak">
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
          "relative px-[36px] py-[24px] transition-colors hover:bg-grey-fill-weaker",
          !notification.read && "bg-notif-unread-bg",
        )}
      >
        {!notification.read && (
          <div
            className="absolute h-[8px] w-[8px] rounded-full bg-brand-text"
            style={{ left: "18px", top: "50%", transform: "translateY(-50%)" }}
            aria-hidden
          />
        )}

        <div className="flex flex-col gap-[12px]">
          <div className="flex items-center justify-between gap-[12px]">
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

          <div className="flex flex-col gap-[4px]">
            <p className="text-paragraph-1 font-semibold leading-[25px] text-grey-text-strong">
              {title}
            </p>
            <p className="line-clamp-2 text-paragraph-2 leading-[22px] text-grey-text-weak">
              {body}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
