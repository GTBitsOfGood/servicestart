import { defineFeature } from "@/core/features/defineFeature";

export const dashboard = defineFeature({
  id: "dashboard",
  navItems: [
    { label: "Home", href: "/", icon: "house", order: 10 },
    {
      label: "Admin Dashboard",
      href: "/settings/admindashboard",
      order: 30,
      parent: "/settings",
    },
    {
      label: "Dashboard",
      href: "/settings/dashboard",
      order: 40,
      parent: "/settings",
    },
    {
      label: "Dashboard Content",
      href: "/settings/dashboard-content",
      order: 50,
      parent: "/settings",
      requireAdmin: true,
    },
  ],
});
