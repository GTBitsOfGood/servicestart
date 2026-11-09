import { z } from "zod";
import { configGroup, defineConfig } from "@/core/config/defineConfig";
import { OrganizationConfigKey } from "@/core/config/schema";

// The membership context's config keys. core/config/registry.ts collects them.

const toggle = z.boolean({ error: "Value must be 'true' or 'false'" });

// The members page predates feature toggles, so it's on unless turned off.
export const membersPageEnabled = defineConfig({
  key: OrganizationConfigKey.MembersPageEnabled,
  schema: toggle,
  default: true,
  visibility: "admin",
  label: "members page toggle",
});

export const memberTypesEnabled = defineConfig({
  key: OrganizationConfigKey.MemberTypesEnabled,
  schema: toggle,
  default: false,
  visibility: "admin",
  label: "member types toggle",
});

export const autoApproveSignups = defineConfig({
  key: OrganizationConfigKey.AutoApproveSignups,
  schema: toggle,
  default: false,
  visibility: "admin",
  label: "auto-approve toggle",
});

export const MEMBERSHIP_CONFIG = configGroup(
  membersPageEnabled,
  memberTypesEnabled,
  autoApproveSignups,
);
