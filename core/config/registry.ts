import { CORE_CONFIG } from "@/core/config/config";
import type { ConfigDefinition } from "@/core/config/defineConfig";
import { OrganizationConfigKey } from "@/core/config/schema";
import { DASHBOARD_CONFIG } from "@/features/dashboard/config";
import { FORMS_CONFIG } from "@/features/forms/config";
import { MEMBERSHIP_CONFIG } from "@/features/membership/config";
import { NAVIGATION_CONFIG } from "@/features/navigation/config";

/*
 * Every config key's definition. Each context declares its keys in its own
 * config.ts; this barrel collects them, the way core/db/schema.ts collects
 * tables, so it's the one core/ file that imports every context. Adding a key:
 * add it to OrganizationConfigKey, then one defineConfig entry in the owning
 * context's config.ts. No migration.
 *
 * Definitions are only Zod schemas and defaults, so client code may import
 * this file (useOrganizationConfig does). Reads and writes are in store.ts.
 */
export const configRegistry = {
  ...CORE_CONFIG,
  ...FORMS_CONFIG,
  ...MEMBERSHIP_CONFIG,
  ...NAVIGATION_CONFIG,
  ...DASHBOARD_CONFIG,
} satisfies {
  [K in OrganizationConfigKey]: ConfigDefinition<K, unknown>;
};

export type ConfigRegistry = typeof configRegistry;

/** The value type of a key, from its schema. */
export type ConfigValue<K extends OrganizationConfigKey> =
  ConfigRegistry[K] extends ConfigDefinition<K, infer T> ? T : never;

/** Values for a set of keys, each with its own type. */
export type ConfigValues<K extends OrganizationConfigKey> = {
  [P in K]: ConfigValue<P>;
};

export function isConfigKey(key: string): key is OrganizationConfigKey {
  return Object.hasOwn(configRegistry, key);
}

export function getConfigDefinition<K extends OrganizationConfigKey>(
  key: K,
): ConfigDefinition<K, ConfigValue<K>> {
  return configRegistry[key] as unknown as ConfigDefinition<K, ConfigValue<K>>;
}
