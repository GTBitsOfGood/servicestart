"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import NotificationTag from "@/components/notifications/NotificationTag";
import api from "@/lib/api";
import { NotificationType } from "@/lib/schema";

interface NotificationDetails {
  id: string;
  userId: string;
  organizationId: string;
  createdAt: string;
  read: boolean;
  type: NotificationType;
  text: string;
}

function formatDate(dateString: string): string {
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
  const router = useRouter();
  const notificationId = params.notificationId;

  const [notification, setNotification] = useState<NotificationDetails | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!notificationId) {
      router.replace("/inbox");
      return;
    }

    const controller = new AbortController();

    api.notifications[":id"]
      .$get(
        {
          param: { id: notificationId },
        },
        { init: { signal: controller.signal } },
      )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load notification");
        }
        const json = (await response.json()) as NotificationDetails;
        setNotification(json);
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }
        setNotification(null);
        setHasError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [notificationId, router]);

  useEffect(() => {
    if (!notificationId || !notification || notification.read) {
      return;
    }

    api.notifications[":id"]
      .$patch({
        param: { id: notificationId },
        json: { read: true },
      })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const updated = (await response.json()) as NotificationDetails;
        setNotification(updated);
      })
      .catch(() => undefined);
  }, [notificationId, notification]);

  useEffect(() => {
    if (hasError) {
      router.replace("/inbox");
    }
  }, [hasError, router]);

  if (isLoading) {
    return (
      <div className="w-full max-w-[1272px] mx-auto px-6 py-10 desktop:px-12 animate-pulse">
        <div className="h-[22px] w-[180px] bg-grey-fill-weak rounded mb-[24px]" />
        <div className="border border-grey-stroke-weak rounded-lg p-[36px]">
          <div className="flex items-start justify-between mb-[24px]">
            <div className="w-[141px] h-[32px] bg-grey-fill-weak rounded-full" />
            <div className="w-[200px] h-[20px] bg-grey-fill-weak rounded" />
          </div>
          <div className="space-y-[12px]">
            <div className="w-full h-[20px] bg-grey-fill-weak rounded" />
            <div className="w-full h-[20px] bg-grey-fill-weak rounded" />
            <div className="w-3/4 h-[20px] bg-grey-fill-weak rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!notification) {
    return null;
  }

  return (
    <div className="w-full max-w-[1272px] mx-auto px-6 py-10 desktop:px-12">
      <button
        onClick={() => router.push("/inbox")}
        className="flex items-center gap-[6px] text-paragraph-2 text-grey-text-weak hover:text-grey-text-strong mb-[24px]"
      >
        <BogIcon name="arrow-left" size={18} />
        Back to Notifications
      </button>

      <div className="border border-grey-stroke-weak rounded-lg p-[36px]">
        <div className="flex items-start justify-between mb-[24px]">
          <NotificationTag type={notification.type} variant="light" />
          <span className="text-paragraph-2 text-grey-text-weak">
            {formatDate(notification.createdAt)}
          </span>
        </div>

        <div className="text-paragraph-1 text-grey-text-strong whitespace-pre-wrap leading-[24px]">
          {notification.text}
        </div>
      </div>
    </div>
  );
}
