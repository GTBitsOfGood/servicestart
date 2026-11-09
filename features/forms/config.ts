import { z } from "zod";
import { configGroup, defineConfig } from "@/core/config/defineConfig";
import { OrganizationConfigKey } from "@/core/config/schema";

// The forms context's config keys. core/config/registry.ts collects them.

export const formsEnabled = defineConfig({
  key: OrganizationConfigKey.FormsEnabled,
  schema: z.boolean({ error: "Value must be 'true' or 'false'" }),
  default: false,
  visibility: "admin",
  label: "forms toggle",
});

export const FORMS_CONFIG = configGroup(formsEnabled);
