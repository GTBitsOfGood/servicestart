"use client";

import BogIcon from "@/components/bog/BogIcon/BogIcon";
import type { IconName } from "@/components/bog/BogIcon/BogIcon";
import { NotificationType } from "@/lib/schema";

const TAG_CONFIG: Record<
  NotificationType,
  { label: string; icon: IconName; color: string; bg: string }
> = {
  [NotificationType.ActionRequired]: {
    label: "Action Required",
    icon: "warning",
    color: "var(--color-notif-action-required)",
    bg: "var(--color-notif-action-required-bg)",
  },
  [NotificationType.Announcement]: {
    label: "Announcement",
    icon: "share",
    color: "var(--color-notif-announcement)",
    bg: "var(--color-notif-announcement-bg)",
  },
  [NotificationType.Reminder]: {
    label: "Reminder",
    icon: "bell",
    color: "var(--color-notif-reminder)",
    bg: "var(--color-notif-reminder-bg)",
  },
  [NotificationType.Members]: {
    label: "Members",
    icon: "users",
    color: "var(--color-notif-members)",
    bg: "var(--color-notif-members-bg)",
  },
  [NotificationType.ScheduleUpdate]: {
    label: "Schedule Update",
    icon: "calendar",
    color: "var(--color-notif-schedule-update)",
    bg: "var(--color-notif-schedule-update-bg)",
  },
  [NotificationType.Confirmation]: {
    label: "Confirmation",
    icon: "check",
    color: "var(--color-notif-confirmation)",
    bg: "var(--color-notif-confirmation-bg)",
  },
  [NotificationType.General]: {
    label: "General",
    icon: "info",
    color: "var(--color-notif-general)",
    bg: "var(--color-notif-general-bg)",
  },
};

interface NotificationTagProps {
  type: string;
  variant?: "light" | "text";
}

function getTagConfig(type: string) {
  switch (type) {
    case NotificationType.ActionRequired:
      return TAG_CONFIG[NotificationType.ActionRequired];
    case NotificationType.Announcement:
      return TAG_CONFIG[NotificationType.Announcement];
    case NotificationType.Reminder:
      return TAG_CONFIG[NotificationType.Reminder];
    case NotificationType.Members:
      return TAG_CONFIG[NotificationType.Members];
    case NotificationType.ScheduleUpdate:
      return TAG_CONFIG[NotificationType.ScheduleUpdate];
    case NotificationType.Confirmation:
      return TAG_CONFIG[NotificationType.Confirmation];
    default:
      return TAG_CONFIG[NotificationType.General];
  }
}

export default function NotificationTag({
  type,
  variant = "light",
}: NotificationTagProps) {
  const config = getTagConfig(type);

  if (variant === "text") {
    return (
      <span
        className="whitespace-nowrap text-[14px] font-semibold uppercase leading-[28px]"
        style={{ color: config.color }}
      >
        {config.label}
      </span>
    );
  }

  return (
    <span
      className="inline-flex h-[32px] items-center gap-[8px] whitespace-nowrap rounded-[48px] px-[12px] text-[14px] leading-[28px]"
      style={{
        backgroundColor: config.bg,
        color: config.color,
      }}
    >
      <BogIcon name={config.icon} size={20} color={config.color} />
      {config.label}
    </span>
  );
}

export { TAG_CONFIG };
