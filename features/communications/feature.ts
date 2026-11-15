import { defineFeature } from "@/core/features/defineFeature";

export const communications = defineFeature({
  id: "communications",
  navItems: [{ label: "Inbox", href: "/inbox", icon: "bell", order: 40 }],
  widgets: [
    { id: "notifications", label: "Notifications" },
    { id: "newsletter", label: "Newsletter" },
  ],
});
