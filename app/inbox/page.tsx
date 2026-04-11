"use client";

import { useEffect, useMemo, useState } from "react";
import { DropdownMenu } from "radix-ui";
import BogButton from "@/components/bog/BogButton/BogButton";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import BogTextInput from "@/components/bog/BogTextInput/BogTextInput";
import NotificationItem from "@/components/notifications/NotificationItem";
import { useNotifications } from "@/lib/hooks/useNotifications";
import { NotificationType } from "@/lib/schema";
import { cn } from "@/lib/utils";
import authClient from "@/lib/authClient";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";
import { isAdmin } from "@/lib/clientUtils";
import SendEmailModal from "@/components/SendEmailModal";
import api from "@/lib/api";

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

function LoadingSkeleton() {
  return (
    <div className="mx-auto w-full mobile:w-9/10 max-w-8xl animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-full bg-grey-fill-weak" />
          <div className="h-10 w-52 rounded bg-grey-fill-weak" />
        </div>
        <div className="h-10 w-40 rounded bg-grey-fill-weak" />
      </div>

      <div className="mt-5 flex flex-col gap-3 mobile:flex-row mobile:items-center mobile:justify-between">
        <div className="flex gap-2">
          <div className="h-10 w-48 rounded bg-grey-fill-weak" />
          <div className="h-10 w-48 rounded bg-grey-fill-weak" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-24 rounded bg-grey-fill-weak" />
          <div className="h-10 w-full mobile:w-80 rounded bg-grey-fill-weak" />
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-grey-stroke-weak">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="border-t border-grey-stroke-weak px-5 py-5 mobile:px-14 mobile:py-10 first:border-t-0"
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="h-8 w-36 rounded-full bg-grey-fill-weak" />
              <div className="h-5 w-24 rounded bg-grey-fill-weak" />
            </div>
            <div className="mb-5 h-6 w-3/5 rounded bg-grey-fill-weak" />
            <div className="flex flex-col gap-3">
              <div className="h-5 w-full rounded bg-grey-fill-weak" />
              <div className="h-5 w-full rounded bg-grey-fill-weak" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function InboxPage() {
  const { data: session } = authClient.useSession();
  const { organization } = useActiveOrganization();
  const isAuthorizedAdmin = isAdmin(organization?.data, session?.user);

  const [tab, setTab] = useState<InboxTab>("all");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FilterValue>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    allNotifications,
    unreadNotifications,
    unreadCount,
    isLoading,
    isRefreshing,
    errorMessage,
    refreshNotifications,
    handleDelete,
    handleToggleRead,
  } = useNotifications(filterType === "all" ? undefined : filterType);

  const notifications = tab === "all" ? allNotifications : unreadNotifications;

  const filteredNotifications = useMemo(() => {
    let result = notifications;

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter((notification) =>
        notification.text.toLowerCase().includes(term),
      );
    }

    return result;
  }, [notifications, search]);

  const organizationId = organization?.data?.id;
  const [recipients, setRecipients] = useState<{ id: string; name: string }[]>(
    [],
  );

  useEffect(() => {
    if (!organizationId) return;
    api.members
      .$get({ query: { page: "1", pageSize: "100" } })
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        throw new Error("Failed to fetch members");
      })
      .then((resJson) => {
        if ("data" in resJson) {
          setRecipients(
            resJson.data.map((m: { userId: string; name: string }) => ({
              id: m.userId,
              name: m.name,
            })),
          );
        }
      })
      .catch((err) => console.error(err));
  }, [organizationId]);

  if (isLoading) {
    return (
      <div className="px-6 py-6 mobile:px-10 mobile:py-16 desktop:px-20">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="px-6 py-6 mobile:px-10 mobile:py-16 desktop:px-20">
      <div className="mx-auto flex w-full mobile:w-9/10 max-w-8xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <BogIcon
                name="bell"
                size={48}
                color="var(--color-grey-text-strong)"
              />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex min-w-6 items-center justify-center rounded-full border-2 border-white bg-brand-text px-1 text-small font-bold leading-5 text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <h1 className="text-heading-2 text-grey-text-strong">
              Notifications
            </h1>
          </div>
          {isAuthorizedAdmin && (
            <BogButton
              variant="primary"
              size="medium"
              onClick={() => setIsModalOpen(true)}
            >
              New +
            </BogButton>
          )}
        </div>

        <div className="flex flex-col gap-3 mobile:flex-row mobile:items-center mobile:justify-between">
          <div className="flex">
            <button
              type="button"
              className={cn(
                "flex items-center justify-center px-4 py-2 mobile:px-8 border-b-2 text-paragraph-2 font-semibold",
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
                "flex items-center justify-center gap-1 px-4 py-2 mobile:px-8 border-b-2 text-paragraph-2",
                tab === "unread"
                  ? "border-grey-text-strong text-grey-text-strong font-semibold"
                  : "border-transparent text-grey-text-weak hover:text-grey-text-strong",
              )}
              onClick={() => setTab("unread")}
            >
              Unread
              {unreadCount > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-grey-fill-weak px-1.5 text-small font-medium text-grey-text-weak">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex w-full items-center gap-3 mobile:w-auto">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded border border-grey-stroke-weak px-3 py-2 text-paragraph-2 text-grey-text-strong hover:bg-grey-fill-weaker"
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
                  className="z-50 w-56 rounded-lg border border-grey-stroke-weak bg-white py-1 shadow-lg"
                >
                  {FILTER_OPTIONS.map((option) => (
                    <DropdownMenu.Item
                      key={option.value}
                      className="flex cursor-pointer items-center gap-3 px-4 py-2 text-paragraph-2 text-grey-text-strong outline-none data-[highlighted]:bg-grey-fill-weaker"
                      onSelect={() => setFilterType(option.value)}
                    >
                      <span
                        className={cn(
                          "inline-flex size-5 items-center justify-center rounded-sm border",
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

            <div className="w-full mobile:max-w-sm">
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

        <div className="overflow-hidden rounded-lg border border-grey-stroke-weak">
          {errorMessage ? (
            <div className="flex flex-col items-center justify-center gap-4 px-4 py-16 mobile:px-10 mobile:py-24 text-center">
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
            <div className="flex items-center justify-center px-4 py-20 mobile:px-10 mobile:py-40 text-center">
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
      <SendEmailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        recipients={recipients}
        onSend={async ({ subject, body, recipientIds }) => {
          if (!organizationId) return;
          const res = await api.emails.$post({
            json: { subject, body, recipientIds },
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(
              (data as { error?: string }).error ?? "Failed to send email",
            );
          }
        }}
      />
    </div>
  );
}
