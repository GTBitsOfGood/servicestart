"use client";

import { useMemo, useState } from "react";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import api from "@/core/api/client";
import { useNotifications } from "@/features/communications/hooks/useNotifications";
import { NotificationType } from "@/features/communications/schema";

function notificationMessage(text: string) {
  const titleBreak = text.indexOf("\n");
  return titleBreak === -1 ? text : text.slice(titleBreak + 1);
}

export default function DashboardAlertBanner() {
  const {
    unreadNotifications,
    isLoading,
    isRefreshing,
    errorMessage,
    refreshNotifications,
  } = useNotifications(NotificationType.Announcement);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isDismissing, setIsDismissing] = useState(false);
  const [dismissError, setDismissError] = useState<string | null>(null);

  const visibleAlerts = useMemo(
    () =>
      unreadNotifications.filter(
        (notification) => !dismissedIds.has(notification.id),
      ),
    [dismissedIds, unreadNotifications],
  );

  if (isLoading) return null;

  if (visibleAlerts.length === 0) {
    if (!errorMessage) return null;

    return (
      <section
        aria-label="Dashboard alerts"
        className="mb-8 flex items-start gap-4 rounded-lg border border-status-amber-stroke-strong bg-status-amber-fill px-6 py-6 desktop:mb-40 desktop:gap-13 desktop:px-13 desktop:py-13"
      >
        <span
          aria-hidden="true"
          className="mt-1 size-8 shrink-0 rounded-full bg-status-amber-text/80"
        />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-3 font-paragraph!">
          <p role="status" className="text-paragraph-2 text-page-text">
            {errorMessage}
          </p>
          <button
            type="button"
            disabled={isRefreshing}
            onClick={() => void refreshNotifications()}
            className="theme-control rounded-full border border-brand-text px-4 py-2 text-small font-semibold text-brand-text hover:bg-brand-fill disabled:cursor-wait disabled:opacity-50"
          >
            {isRefreshing ? "Retrying…" : "Retry"}
          </button>
        </div>
      </section>
    );
  }

  const dismissAlerts = async () => {
    const alertIds = visibleAlerts.map(({ id }) => id);
    setIsDismissing(true);
    setDismissError(null);

    try {
      const responses = await Promise.all(
        alertIds.map((id) =>
          api.notifications[":id"].$patch({
            param: { id },
            json: { read: true },
          }),
        ),
      );

      if (responses.some((response) => !response.ok)) {
        throw new Error("Unable to dismiss dashboard alerts");
      }

      setDismissedIds((current) => new Set([...current, ...alertIds]));
      await refreshNotifications();
    } catch {
      setDismissError("Could not dismiss the alerts. Please try again.");
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <section
      aria-label="Dashboard alerts"
      className="mb-8 flex items-start gap-4 rounded-lg border border-status-amber-stroke-strong bg-status-amber-fill px-6 py-6 desktop:mb-40 desktop:gap-13 desktop:px-13 desktop:py-13"
    >
      <span
        aria-hidden="true"
        className="mt-1 size-8 shrink-0 rounded-full bg-status-amber-text/80"
      />
      <div className="min-w-0 flex-1 font-paragraph!">
        <p className="text-mobile-paragraph-2! leading-7! text-page-text/70">
          {visibleAlerts.length} New Alert(s)
        </p>
        <p className="text-paragraph-2 leading-8! text-page-text">
          {notificationMessage(visibleAlerts[0].text)}
        </p>
        {dismissError && (
          <p role="status" className="mt-2 text-small text-status-red-text">
            {dismissError}
          </p>
        )}
        {errorMessage && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p role="status" className="text-small text-status-red-text">
              {errorMessage}
            </p>
            <button
              type="button"
              disabled={isRefreshing}
              onClick={() => void refreshNotifications()}
              className="theme-control rounded-full border border-brand-text px-3 py-1 text-small font-semibold text-brand-text hover:bg-brand-fill disabled:cursor-wait disabled:opacity-50"
            >
              {isRefreshing ? "Retrying…" : "Retry"}
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss alerts"
        disabled={isDismissing}
        onClick={() => void dismissAlerts()}
        className="-m-3 flex size-16 shrink-0 items-center justify-center rounded-full text-page-text/70 hover:bg-status-amber-stroke-weak disabled:cursor-wait disabled:opacity-50"
      >
        <BogIcon name="x" size={20} aria-hidden="true" />
      </button>
    </section>
  );
}
