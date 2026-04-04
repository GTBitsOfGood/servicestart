import type { DashboardLayout } from "./schema";

const DEFAULT_LAYOUT: DashboardLayout = {
  layout: "horizontal",
  widgets: [
    { id: "events", size: "tall" },
    { id: "notifications", size: "tall" },
  ],
};

export const DEFAULT_ADMIN_LAYOUT = DEFAULT_LAYOUT;
export const DEFAULT_MEMBER_LAYOUT = DEFAULT_LAYOUT;
