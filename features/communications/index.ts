// The communications context's public API: other contexts import from
// "@/features/communications", never from a file inside it.
// Its React components and widgets are in ./ui.ts.

export { NotificationType } from "./schema";
export { PostDashboardAlertSchema } from "./lib/alerts";
export type { PostDashboardAlert } from "./lib/alerts";
export { useEmailRecipients } from "./hooks/useEmailRecipients";
export { useUnreadNotificationCount } from "./hooks/useUnreadNotificationCount";
export { NotificationService } from "./services/NotificationService";
