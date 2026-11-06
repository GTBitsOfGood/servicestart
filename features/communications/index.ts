// The communications context's public API: other contexts import from
// "@/features/communications", never from a file inside it.

export { NotificationType } from "./schema";
export { PostDashboardAlertSchema } from "./lib/alerts";
export type { PostDashboardAlert } from "./lib/alerts";
export { useEmailRecipients } from "./hooks/useEmailRecipients";
export { useUnreadNotificationCount } from "./hooks/useUnreadNotificationCount";
export { default as DashboardAlertBanner } from "./components/DashboardAlertBanner";
export { default as NotificationItem } from "./components/NotificationItem";
export { default as NotificationsSidebar } from "./components/NotificationsSidebar";
export { default as SendEmailModal } from "./components/SendEmailModal";
export { default as NewsletterWidget } from "./widgets/NewsletterWidget";
export { default as NotificationsWidget } from "./widgets/NotificationsWidget";
export { NotificationService } from "./services/NotificationService";
