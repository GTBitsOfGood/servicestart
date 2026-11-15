import { defineFeature } from "@/core/features/defineFeature";

export const events = defineFeature({
  id: "events",
  navItems: [{ label: "Events", href: "/events", icon: "calendar", order: 60 }],
  widgets: [
    { id: "events", label: "Events" },
    { id: "weekly_calendar", label: "Weekly Calendar" },
  ],
});
