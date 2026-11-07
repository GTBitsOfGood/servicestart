// The communications context's React components and widgets, for other contexts:
// import them from "@/features/communications/ui". They're kept out of index.ts, which
// also has to load outside the bundler (seed scripts, Playwright), where their
// CSS imports fail.

export { default as DashboardAlertBanner } from "./components/DashboardAlertBanner";
export { default as NotificationItem } from "./components/NotificationItem";
export { default as NotificationsSidebar } from "./components/NotificationsSidebar";
export { default as SendEmailModal } from "./components/SendEmailModal";
export { default as NewsletterWidget } from "./widgets/NewsletterWidget";
export { default as NotificationsWidget } from "./widgets/NotificationsWidget";
