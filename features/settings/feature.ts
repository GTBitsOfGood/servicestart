import { defineFeature } from "@/core/features/defineFeature";

// The Settings page. Each settings subpage belongs to the feature it
// configures and names "/settings" as its parent.
export const settings = defineFeature({
  id: "settings",
  navItems: [
    {
      label: "Settings",
      href: "/settings",
      icon: "gear",
      order: 50,
      requireAdmin: true,
    },
  ],
});
