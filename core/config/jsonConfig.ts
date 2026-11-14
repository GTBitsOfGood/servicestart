import type { z } from "zod";
import {
  type ConfigDefinition,
  defineConfig,
} from "@/core/config/defineConfig";
import type { OrganizationConfigKey } from "@/core/config/schema";

/**
 * The pre-registry way to declare a JSON key, kept while #336 changes the
 * per-type layout key. Whichever of #334 and #336 merges second converts that
 * key to defineConfig and deletes this.
 */
export function jsonConfig<K extends OrganizationConfigKey, T>(
  key: K,
  label: string,
  schema: z.ZodType<T>,
  fallback: T,
): ConfigDefinition<K, T> {
  return defineConfig({
    key,
    schema,
    default: fallback,
    visibility: "admin",
    label,
  });
}
