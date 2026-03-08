"use client";

import { Toast } from "radix-ui";
import { useNotificationPolling } from "@/lib/hooks/useNotificationPolling";
import NotificationToast from "./NotificationToast";

export default function NotificationToastProvider() {
  const { toasts, dismissToast } = useNotificationPolling();

  return (
    <Toast.Provider swipeDirection="right">
      {toasts.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={dismissToast}
        />
      ))}

      <Toast.Viewport className="fixed inset-x-4 top-4 z-50 flex flex-col gap-3 outline-none sm:inset-x-auto sm:right-6 sm:top-6 sm:w-full sm:max-w-lg" />
    </Toast.Provider>
  );
}
