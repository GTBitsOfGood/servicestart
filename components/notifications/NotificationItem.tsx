"use client";

import { useState } from "react";
import Link from "next/link";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import NotificationTag from "./NotificationTag";
import { NotificationType } from "@/lib/schema";

export interface NotificationListItem {
  id: string;
  userId: string;
  organizationId: string;
  createdAt: string;
  read: boolean;
  type: NotificationType;
  text: string;
}

function formatTimeAgo(dateString: string): string {
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
  const [isHovered, setIsHovered] = useState(false);

  const title = notification.text.split("\n")[0];
  const body = notification.text;

  if (compact) {
    return (
      <Link
        href={`/inbox/${notification.id}`}
        className="block border-t border-grey-stroke-weak first:border-t-0"
      >
        <div
          className={`relative px-[36px] py-[24px] flex flex-col gap-[6px] hover:bg-grey-fill-weaker ${
            !notification.read ? "bg-notif-unread-bg" : ""
          }`}
        >
          {!notification.read && (
            <div
              className="absolute w-[8px] h-[8px] rounded-full bg-brand-text"
              style={{ left: "17px", top: "63px" }}
            />
          )}

          <div className="flex flex-col gap-[2px]">
            <div className="flex items-center justify-between">
              <NotificationTag type={notification.type} variant="text" />
              <span className="text-[16px] text-grey-text-weak whitespace-nowrap">
                {formatTimeAgo(notification.createdAt)}
              </span>
            </div>
            <p className="text-[18px] font-semibold text-grey-text-strong leading-normal">
              {title}
            </p>
          </div>

          <p className="text-[16px] text-grey-text-weak leading-normal line-clamp-2">
            {body}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/inbox/${notification.id}`}
      className="block border-t border-grey-stroke-weak first:border-t-0"
    >
      <div
        className={`relative px-[36px] py-[24px] hover:bg-grey-fill-weaker ${
          !notification.read ? "bg-notif-unread-bg" : ""
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {!notification.read && (
          <div
            className="absolute w-[8px] h-[8px] rounded-full bg-brand-text"
            style={{ left: "18px", top: "50%" }}
          />
        )}

        <div className="flex flex-col gap-[12px]">
          <div className="flex items-center justify-between">
            <NotificationTag type={notification.type} variant="light" />
            <div className="flex items-center gap-2 shrink-0">
              {isHovered ? (
                <>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete?.(notification.id);
                    }}
                    className="p-1 rounded hover:bg-grey-fill-weak text-grey-icon-weak hover:text-grey-text-strong"
                    title="Delete"
                  >
                    <BogIcon name="trash" size={22} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleRead?.(notification.id, !notification.read);
                    }}
                    className="p-1 rounded hover:bg-grey-fill-weak text-grey-icon-weak hover:text-grey-text-strong"
                    title={
                      notification.read ? "Mark as unread" : "Mark as read"
                    }
                  >
                    <BogIcon
                      name={notification.read ? "bell" : "check"}
                      size={22}
                    />
                  </button>
                </>
              ) : (
                <span className="text-paragraph-2 text-grey-text-weak whitespace-nowrap">
                  {formatTimeAgo(notification.createdAt)}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-[4px]">
            <p className="text-paragraph-1 font-semibold text-grey-text-strong leading-[25px]">
              {title}
            </p>
            <p className="text-paragraph-2 text-grey-text-weak leading-[22px] line-clamp-2">
              {body}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
