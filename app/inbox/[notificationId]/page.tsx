"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import NotificationTag from "@/components/notifications/NotificationTag";
import api from "@/lib/api";

interface NotificationDetails {
  id: string;
  userId: string;
  organizationId: string;
  createdAt: string;
  read: boolean;
  type: string;
  text: string;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotificationDetailPage() {
  const params = useParams<{ notificationId: string }>();
  const notificationId = params.notificationId;

  const [notification, setNotification] = useState<NotificationDetails | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadNotification() {
      try {
        const response = await api.notifications[":id"].$get({
          param: { id: notificationId },
        });

        if (!response.ok) {
          throw new Error("Could not load notification");
        }

        const json = await response.json();

        if (!isActive) {
          return;
        }

        setNotification(json);
        setErrorMessage(null);
      } catch {
        if (!isActive) {
          return;
        }

        setNotification(null);
        setErrorMessage("Could not load this notification.");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadNotification();

    return () => {
      isActive = false;
    };
  }, [notificationId]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
        <div className="mb-6 h-5 w-44 rounded bg-grey-fill-weak" />
        <div className="rounded-xl border border-grey-stroke-weak p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="h-8 w-36 rounded-full bg-grey-fill-weak" />
            <div className="h-5 w-52 rounded bg-grey-fill-weak" />
          </div>
          <div className="space-y-3">
            <div className="h-5 w-full rounded bg-grey-fill-weak" />
            <div className="h-5 w-full rounded bg-grey-fill-weak" />
            <div className="h-5 w-3/4 rounded bg-grey-fill-weak" />
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-paragraph-2 text-grey-text-weak">{errorMessage}</p>
        <Link
          href="/inbox"
          className="inline-flex items-center gap-2 text-paragraph-2 text-grey-text-strong hover:text-brand-text"
        >
          <BogIcon name="arrow-left" size={18} />
          Back to Notifications
        </Link>
      </div>
    );
  }

  if (!notification) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/inbox"
        className="mb-6 inline-flex items-center gap-2 text-paragraph-2 text-grey-text-weak hover:text-grey-text-strong"
      >
        <BogIcon name="arrow-left" size={18} />
        Back to Notifications
      </Link>

      <div className="rounded-xl border border-grey-stroke-weak p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <NotificationTag type={notification.type} variant="light" />
          <span className="text-paragraph-2 text-grey-text-weak">
            {formatDate(notification.createdAt)}
          </span>
        </div>

        <div className="whitespace-pre-wrap text-paragraph-1 leading-6 text-grey-text-strong">
          {notification.text}
        </div>
      </div>
    </div>
  );
}
