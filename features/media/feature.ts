import { defineFeature } from "@/core/features/defineFeature";

export const media = defineFeature({
  id: "media",
  navItems: [
    {
      label: "Media Library",
      href: "/media",
      icon: "folder",
      order: 30,
      requireAdmin: true,
    },
  ],
});
