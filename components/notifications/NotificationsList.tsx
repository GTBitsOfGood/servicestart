"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import BogButton from "@/components/bog/BogButton/BogButton";
import BogTextInput from "@/components/bog/BogTextInput/BogTextInput";
import api from "@/lib/api";
import { NotificationType } from "@/lib/schema";
import NotificationItem, {
  type NotificationListItem,
} from "./NotificationItem";

type NotificationsResponse = {
  data?: NotificationListItem[];
};

type UnreadCountResponse = {
  count?: number;
};

const FILTER_OPTIONS: { label: string; value: string | null }[] = [
  { label: "All", value: null },
  { label: "Announcements", value: NotificationType.Announcement },
  { label: "Reminders", value: NotificationType.Reminder },
  { label: "Action Required", value: NotificationType.ActionRequired },
  { label: "Members", value: NotificationType.Members },
  { label: "Schedule Update", value: NotificationType.ScheduleUpdate },
  { label: "Confirmation", value: NotificationType.Confirmation },
];

async function fetchNotifications(
  read: "" | "false",
  signal?: AbortSignal,
): Promise<NotificationListItem[]> {
  const response = await api.notifications.$get(
    {
      query: { read, pageSize: "50" },
    },
    signal ? { init: { signal } } : undefined,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch notifications");
  }

  const json = (await response.json()) as NotificationsResponse;
  return json.data ?? [];
}

async function fetchUnreadCount(signal?: AbortSignal): Promise<number> {
  const response = await api.notifications.unreadCount.$get(
    {},
    signal ? { init: { signal } } : undefined,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch unread count");
  }

  const json = (await response.json()) as UnreadCountResponse;
  return Number(json.count ?? 0);
}

function LoadingSkeleton() {
  return (
    <div className="w-full max-w-[1272px] mx-auto animate-pulse">
      <div className="flex items-center justify-between h-[48px]">
        <div className="flex items-center gap-[11px]">
          <div className="w-[48px] h-[48px] bg-grey-fill-weak rounded-full" />
          <div className="w-[208px] h-[44px] bg-grey-fill-weak rounded" />
        </div>
        <div className="w-[167px] h-[40px] bg-grey-fill-weak rounded-lg" />
      </div>

      <div className="flex items-center justify-between mt-[12px] h-[42px]">
        <div className="flex gap-0">
          <div className="w-[80px] h-[40px] bg-grey-fill-weak rounded" />
          <div className="w-[100px] h-[40px] bg-grey-fill-weak rounded ml-2" />
        </div>
        <div className="flex items-center gap-[12px]">
          <div className="w-[93px] h-[42px] bg-grey-fill-weak rounded-lg" />
          <div className="w-[406px] h-[42px] bg-grey-fill-weak rounded-lg" />
        </div>
      </div>

      <div className="border border-grey-stroke-weak rounded-lg overflow-hidden mt-[16px]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="px-[36px] py-[24px] border-t border-grey-stroke-weak first:border-t-0"
          >
            <div className="flex items-center justify-between mb-[12px]">
              <div className="w-[141px] h-[28px] bg-grey-fill-weak rounded-full" />
              <div className="w-[92px] h-[20px] bg-grey-fill-weak rounded" />
            </div>
            <div className="w-[561px] h-[22px] bg-grey-fill-weak rounded mb-[12px]" />
            <div className="space-y-[12px]">
              <div className="w-full h-[20px] bg-grey-fill-weak rounded" />
              <div className="w-full h-[20px] bg-grey-fill-weak rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NotificationsList() {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadNotifications = useCallback(async (signal?: AbortSignal) => {
    const [all, unread, count] = await Promise.all([
      fetchNotifications("", signal),
      fetchNotifications("false", signal),
      fetchUnreadCount(signal),
    ]);

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
    const controller = new AbortController();

    setIsLoading(true);
    setErrorMessage(null);

    loadNotifications(controller.signal)
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }
        setAllNotifications([]);
        setUnreadNotifications([]);
        setUnreadCount(0);
        setErrorMessage("Unable to load notifications.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
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

    if (filterType) {
      result = result.filter(
        (notification) => notification.type === filterType,
      );
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter((notification) =>
        notification.text.toLowerCase().includes(term),
      );
    }

    return result;
  }, [notifications, search, filterType]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="w-full max-w-[1272px] mx-auto">
      <div className="flex items-center justify-between h-[48px]">
        <div className="flex items-center gap-[11px]">
          <div className="relative w-[48px] h-[48px] flex items-center justify-center">
            <BogIcon
              name="bell"
              size={48}
              color="var(--color-grey-text-strong)"
            />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-[-3px] min-w-[28px] h-[28px] flex items-center justify-center rounded-full bg-brand-text text-white text-[14px] font-semibold leading-[17px]">
                {unreadCount}
              </span>
            )}
          </div>
          <h1 className="text-heading-2">Notifications</h1>
        </div>

        <BogButton
          variant="secondary"
          size="small"
          iconProps={{
            iconProps: { name: "check", size: 16 },
            position: "left",
          }}
          onClick={() => void handleMarkAllRead()}
          disabled={isMarkAllReadPending || isRefreshing || unreadCount === 0}
        >
          Mark all read
        </BogButton>
      </div>

      <div className="flex items-center justify-between mt-[12px] h-[42px]">
        <div className="flex h-full">
          <button
            className={`px-[24px] text-paragraph-2 font-medium border-b-2 h-full flex items-center ${
              tab === "all"
                ? "border-grey-text-strong text-grey-text-strong"
                : "border-transparent text-grey-text-weak hover:text-grey-text-strong"
            }`}
            onClick={() => setTab("all")}
          >
            All
          </button>
          <button
            className={`px-[24px] text-paragraph-2 font-medium border-b-2 h-full flex items-center gap-2 ${
              tab === "unread"
                ? "border-grey-text-strong text-grey-text-strong"
                : "border-transparent text-grey-text-weak hover:text-grey-text-strong"
            }`}
            onClick={() => setTab("unread")}
          >
            Unread
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[24px] h-[24px] rounded-full bg-grey-fill-weak text-grey-text-weak text-[12px] font-medium px-1.5">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-[12px]">
          <div className="relative" ref={filterRef}>
            <button
              className="flex items-center gap-[6px] px-[12px] h-[42px] rounded-lg border border-grey-stroke-weak text-paragraph-2 text-grey-text-strong hover:bg-grey-fill-weaker"
              onClick={() => setFilterOpen(!filterOpen)}
            >
              Filter
              <BogIcon name="funnel-simple" size={18} />
            </button>

            {filterOpen && (
              <div className="absolute right-0 top-full mt-1 w-[214px] bg-white border border-grey-stroke-weak rounded-lg shadow-lg z-50 py-1">
                {FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-paragraph-2 text-grey-text-strong hover:bg-grey-fill-weaker text-left"
                    onClick={() => {
                      setFilterType(option.value);
                      setFilterOpen(false);
                    }}
                  >
                    <span
                      className={`w-[18px] h-[18px] rounded border flex items-center justify-center ${
                        filterType === option.value
                          ? "bg-brand-text border-brand-text"
                          : "border-grey-stroke-strong"
                      }`}
                    >
                      {filterType === option.value && (
                        <BogIcon name="check" size={12} color="white" />
                      )}
                    </span>
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-[406px]">
            <BogTextInput
              name="search"
              type="search"
              placeholder="Search notifications..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              iconProps={{
                iconProps: { name: "search", size: 16 },
                position: "right",
              }}
            />
          </div>
        </div>
      </div>

      <div className="border border-grey-stroke-weak rounded-lg overflow-hidden mt-[16px]">
        {errorMessage ? (
          <div className="flex flex-col items-center justify-center h-[240px] gap-4 px-6 text-center">
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
          <div className="flex items-center justify-center h-[605px]">
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
  );
}
