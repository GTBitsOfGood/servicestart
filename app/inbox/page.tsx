"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DropdownMenu } from "radix-ui";
import BogButton from "@/components/bog/BogButton/BogButton";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import BogTextInput from "@/components/bog/BogTextInput/BogTextInput";
import NotificationItem, {
  type NotificationListItem,
} from "@/components/notifications/NotificationItem";
import api from "@/lib/api";
import { NotificationType } from "@/lib/schema";
import { cn } from "@/lib/utils";

type FilterValue = "all" | NotificationType;

const FILTER_OPTIONS = [
  { label: "All types", value: "all" },
  { label: "General", value: NotificationType.General },
  { label: "Announcement", value: NotificationType.Announcement },
  { label: "Reminder", value: NotificationType.Reminder },
  { label: "Action Required", value: NotificationType.ActionRequired },
  { label: "Members", value: NotificationType.Members },
  { label: "Schedule Update", value: NotificationType.ScheduleUpdate },
  { label: "Confirmation", value: NotificationType.Confirmation },
] satisfies { label: string; value: FilterValue }[];

type InboxTab = "all" | "unread";
type ReadFilter = "all" | "read" | "unread";

async function fetchNotifications(read: ReadFilter) {
  const response = await api.notifications.$get({
    query: { read, pageSize: "50" },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch notifications");
  }

  const json = await response.json();
  return json.data ?? [];
}

async function fetchUnreadCount() {
  const response = await api.notifications.unreadCount.$get({});

  if (!response.ok) {
    throw new Error("Failed to fetch unread count");
  }

  const json = await response.json();
  return Number(json.count ?? 0);
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto w-[90%] max-w-[1272px] animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[8px]">
          <div className="h-[48px] w-[48px] rounded-full bg-grey-fill-weak" />
          <div className="h-[44px] w-[208px] rounded-[4px] bg-grey-fill-weak" />
        </div>
        <div className="h-[40px] w-[167px] rounded-[4px] bg-grey-fill-weak" />
      </div>

      <div className="mt-[12px] flex items-center justify-between h-[42px]">
        <div className="flex gap-0">
          <div className="h-[40px] w-[192px] rounded-[4px] bg-grey-fill-weak" />
          <div className="ml-[8px] h-[40px] w-[192px] rounded-[4px] bg-grey-fill-weak" />
        </div>
        <div className="flex items-center gap-[12px]">
          <div className="h-[42px] w-[93px] rounded-[4px] bg-grey-fill-weak" />
          <div className="h-[42px] w-[406px] rounded-[4px] bg-grey-fill-weak" />
        </div>
      </div>

      <div className="mt-[16px] overflow-hidden rounded-[8px] border border-grey-stroke-weak">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="border-t border-grey-stroke-weak px-[36px] py-[24px] first:border-t-0"
          >
            <div className="flex items-center justify-between mb-[12px]">
              <div className="h-[32px] w-[141px] rounded-full bg-grey-fill-weak" />
              <div className="h-[22px] w-[92px] rounded-[4px] bg-grey-fill-weak" />
            </div>
            <div className="h-[25px] w-[561px] rounded-[4px] bg-grey-fill-weak mb-[12px]" />
            <div className="flex flex-col gap-[12px]">
              <div className="h-[22px] w-full rounded-[4px] bg-grey-fill-weak" />
              <div className="h-[22px] w-full rounded-[4px] bg-grey-fill-weak" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function InboxPage() {
  const [tab, setTab] = useState<InboxTab>("all");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FilterValue>("all");

  const [allNotifications, setAllNotifications] = useState<
    NotificationListItem[]
  >([]);
  const [unreadNotifications, setUnreadNotifications] = useState<
    NotificationListItem[]
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkAllReadPending, setIsMarkAllReadPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    const all = await fetchNotifications("all");
    const unread = await fetchNotifications("unread");
    const count = await fetchUnreadCount();

    setAllNotifications(all);
    setUnreadNotifications(unread);
    setUnreadCount(count);
  }, []);

  const refreshNotifications = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await loadNotifications();
      setErrorMessage(null);
    } catch {
      setErrorMessage("Unable to refresh notifications.");
    } finally {
      setIsRefreshing(false);
    }
  }, [loadNotifications]);

  useEffect(() => {
    setIsLoading(true);
    setErrorMessage(null);

    loadNotifications()
      .catch(() => {
        setAllNotifications([]);
        setUnreadNotifications([]);
        setUnreadCount(0);
        setErrorMessage("Unable to load notifications.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [loadNotifications]);

  const runMutation = useCallback(
    async (mutation: () => Promise<Response>, failureMessage: string) => {
      try {
        const response = await mutation();

        if (!response.ok) {
          throw new Error("Mutation failed");
        }

        await refreshNotifications();
      } catch {
        setErrorMessage(failureMessage);
      }
    },
    [refreshNotifications],
  );

  const handleMarkAllRead = useCallback(async () => {
    setIsMarkAllReadPending(true);
    setErrorMessage(null);

    await runMutation(
      () => api.notifications["mark-all-read"].$post({}),
      "Could not mark all notifications as read.",
    );

    setIsMarkAllReadPending(false);
  }, [runMutation]);

  const handleDelete = useCallback(
    (id: string) => {
      setErrorMessage(null);
      void runMutation(
        () => api.notifications[":id"].$delete({ param: { id } }),
        "Could not delete this notification.",
      );
    },
    [runMutation],
  );

  const handleToggleRead = useCallback(
    (id: string, read: boolean) => {
      setErrorMessage(null);
      void runMutation(
        () =>
          api.notifications[":id"].$patch({ param: { id }, json: { read } }),
        "Could not update this notification.",
      );
    },
    [runMutation],
  );

  const notifications = tab === "all" ? allNotifications : unreadNotifications;

  const filteredNotifications = useMemo(() => {
    let result = notifications;

    if (filterType !== "all") {
      result = result.filter(
        (notification) => notification.type === filterType,
      );
    }

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter((notification) =>
        notification.text.toLowerCase().includes(term),
      );
    }

    return result;
  }, [notifications, search, filterType]);

  if (isLoading) {
    return (
      <div className="px-[24px] py-[40px] desktop:px-[48px]">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="px-[24px] py-[40px] desktop:px-[48px]">
      <div className="mx-auto flex w-[90%] max-w-[1272px] flex-col gap-[16px]">
        {/* Header row: bell + title + mark all read */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[8px]">
            <div className="relative flex h-[48px] w-[51px] items-start">
              <BogIcon
                name="bell"
                size={48}
                color="var(--color-grey-text-strong)"
              />
              {unreadCount > 0 && (
                <span className="absolute right-0 top-0 inline-flex min-w-[28px] h-[28px] items-center justify-center rounded-full border-[2px] border-white bg-brand-text text-[14px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <span className="text-[32px] font-bold leading-normal text-grey-text-strong">
              Notifications
            </span>
          </div>

          <BogButton
            variant="secondary"
            size="small"
            iconProps={{
              iconProps: { name: "check", size: 20 },
              position: "left",
            }}
            onClick={() => void handleMarkAllRead()}
            disabled={isMarkAllReadPending || isRefreshing || unreadCount === 0}
          >
            Mark all read
          </BogButton>
        </div>

        {/* Tabs + filter + search row */}
        <div className="flex items-center justify-between h-[42px]">
          {/* Underline tabs */}
          <div className="flex h-full">
            <button
              type="button"
              className={cn(
                "flex items-center justify-center w-[192px] border-b-[2px] text-paragraph-2 font-semibold",
                tab === "all"
                  ? "border-grey-text-strong text-grey-text-strong"
                  : "border-transparent text-grey-text-weak hover:text-grey-text-strong",
              )}
              onClick={() => setTab("all")}
            >
              All
            </button>
            <button
              type="button"
              className={cn(
                "flex items-center justify-center gap-[4px] w-[192px] border-b-[2px] text-paragraph-2",
                tab === "unread"
                  ? "border-grey-text-strong text-grey-text-strong font-semibold"
                  : "border-transparent text-grey-text-weak hover:text-grey-text-strong",
              )}
              onClick={() => setTab("unread")}
            >
              Unread
              {unreadCount > 0 && (
                <span className="inline-flex min-w-[24px] h-[24px] items-center justify-center rounded-full bg-grey-fill-weak px-[6px] text-[12px] font-medium text-grey-text-weak">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Filter + search */}
          <div className="flex items-center gap-[12px]">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="inline-flex h-[42px] items-center gap-[8px] rounded-[4px] border border-grey-stroke-weak px-[12px] text-paragraph-2 text-grey-text-strong hover:bg-grey-fill-weaker"
                >
                  <span>
                    {filterType === "all"
                      ? "Filter"
                      : FILTER_OPTIONS.find((o) => o.value === filterType)
                          ?.label}
                  </span>
                  <BogIcon name="funnel-simple" size={18} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  sideOffset={8}
                  align="end"
                  className="z-50 w-[214px] rounded-[8px] border border-grey-stroke-weak bg-white py-[4px] shadow-lg"
                >
                  {FILTER_OPTIONS.map((option) => (
                    <DropdownMenu.Item
                      key={option.value}
                      className="flex cursor-pointer items-center gap-[12px] px-[16px] py-[10px] text-paragraph-2 text-grey-text-strong outline-none data-[highlighted]:bg-grey-fill-weaker"
                      onSelect={() => setFilterType(option.value)}
                    >
                      <span
                        className={cn(
                          "inline-flex h-[18px] w-[18px] items-center justify-center rounded-[2px] border",
                          filterType === option.value
                            ? "border-brand-text bg-brand-text"
                            : "border-grey-stroke-strong",
                        )}
                      >
                        {filterType === option.value && (
                          <BogIcon name="check" size={12} color="white" />
                        )}
                      </span>
                      {option.label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            <div className="w-[406px]">
              <BogTextInput
                name="search"
                type="search"
                placeholder="Search notifications..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                iconProps={{
                  iconProps: { name: "search", size: 16 },
                  position: "right",
                }}
              />
            </div>
          </div>
        </div>

        {/* Notification list */}
        <div className="overflow-hidden rounded-[8px] border border-grey-stroke-weak">
          {errorMessage ? (
            <div className="flex flex-col items-center justify-center gap-[16px] px-[24px] py-[64px] text-center">
              <p className="text-paragraph-2 text-grey-text-weak">
                {errorMessage}
              </p>
              <BogButton
                variant="secondary"
                size="small"
                onClick={() => void refreshNotifications()}
                disabled={isRefreshing}
              >
                Try again
              </BogButton>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex items-center justify-center px-[24px] py-[96px] text-center">
              <p className="text-heading-3 text-grey-text-weak">
                {search
                  ? "No notifications match your search."
                  : "No notifications yet."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onDelete={handleDelete}
                onToggleRead={handleToggleRead}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
