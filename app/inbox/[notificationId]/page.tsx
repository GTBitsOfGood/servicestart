import Link from "next/link";
import { redirect } from "next/navigation";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import NotificationTag from "@/components/notifications/NotificationTag";
import { NotificationService } from "@/lib/services/NotificationService";
import { redirectIfNotMember } from "@/lib/authUtils";

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

interface NotificationDetailPageProps {
  params: Promise<{ notificationId: string }>;
}

export default async function NotificationDetailPage({
  params,
}: NotificationDetailPageProps) {
  const session = await redirectIfNotMember();
  const { organizationId } = session;

  const { notificationId } = await params;
  const notification = await NotificationService.findById(notificationId);

  if (!notification) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-paragraph-2 text-grey-text-weak">
          Could not load this notification.
        </p>
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

  if (
    notification.userId !== session.user.id ||
    notification.organizationId !== organizationId
  ) {
    redirect("/inbox");
  }

  // Mark as read if it isn't already
  if (!notification.read) {
    await NotificationService.updateReadStatus(notificationId, true);
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
            {formatDate(notification.createdAt.toString())}
          </span>
        </div>

        <div className="whitespace-pre-wrap text-paragraph-1 leading-6 text-grey-text-strong">
          {notification.text}
        </div>
      </div>
    </div>
  );
}
