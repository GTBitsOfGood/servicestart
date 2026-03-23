import type { DashboardLayout } from "./schema";

export const DEFAULT_ADMIN_LAYOUT: DashboardLayout = {
  layout: "horizontal",
  widgets: [
    { id: "events", size: "tall" },
    { id: "notifications", size: "tall" },
  ],
};

export const DEFAULT_MEMBER_LAYOUT: DashboardLayout = {
  layout: "horizontal",
  widgets: [
    { id: "events", size: "tall" },
    { id: "notifications", size: "tall" },
  ],
};
