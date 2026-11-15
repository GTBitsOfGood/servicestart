import { defineFeature } from "@/core/features/defineFeature";
import { OrganizationConfigKey } from "@/core/config/schema";

// Membership has three features because their toggles differ: join requests
// are always on, while the Members page and member types each have one.

export const membership = defineFeature({
  id: "membership",
  widgets: [{ id: "member_requests", label: "New Member Requests" }],
});

export const members = defineFeature({
  id: "members",
  toggle: OrganizationConfigKey.MembersPageEnabled,
  navItems: [
    {
      label: "Members",
      href: "/members",
      icon: "users",
      order: 20,
      requireAdmin: true,
    },
  ],
});

export const memberTypes = defineFeature({
  id: "memberTypes",
  toggle: OrganizationConfigKey.MemberTypesEnabled,
  navItems: [
    {
      label: "Member types",
      href: "/settings/member-types",
      order: 20,
      parent: "/settings",
      requireAdmin: true,
    },
  ],
});
