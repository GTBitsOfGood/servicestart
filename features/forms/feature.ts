import { defineFeature } from "@/core/features/defineFeature";
import { OrganizationConfigKey } from "@/core/config/schema";

export const forms = defineFeature({
  id: "forms",
  toggle: OrganizationConfigKey.FormsEnabled,
  navItems: [
    {
      label: "Forms",
      href: "/settings/forms",
      order: 10,
      parent: "/settings",
      requireAdmin: true,
    },
  ],
  widgets: [
    { id: "application_status", label: "Application Status" },
    { id: "forms_todo", label: "To-Do List" },
    { id: "forms_completed", label: "Completed Forms" },
    { id: "forms_progress", label: "Forms Progress" },
  ],
});
