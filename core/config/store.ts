import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import db from "@/core/db";
import {
  ConfigValidationError,
  decodeConfigValue,
  encodeConfigValue,
} from "@/core/config/defineConfig";
import {
  type ConfigValue,
  type ConfigValues,
  getConfigDefinition,
  isConfigKey,
} from "@/core/config/registry";
import {
  organizationConfig,
  type OrganizationConfigKey,
} from "@/core/config/schema";

/*
 * The one place config rows are read and written. Every key goes through the
 * same path: its definition's schema validates writes and parses reads. Server
 * only; OrganizationConfigService wraps it for callers.
 */

/** Stored rows for these keys, as text, keyed by config key. */
async function readRows(
  organizationId: string,
  keys: readonly OrganizationConfigKey[],
): Promise<Map<string, string>> {
  if (keys.length === 0) return new Map();
  const rows = await db
    .select({ key: organizationConfig.key, value: organizationConfig.value })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        inArray(organizationConfig.key, [...keys]),
      ),
    );
  return new Map(rows.map((row) => [row.key, row.value]));
}

/** Known keys, without duplicates. Unknown keys are ignored. */
function knownKeys<K extends OrganizationConfigKey>(keys: readonly K[]): K[] {
  return [...new Set(keys)].filter((key) => isConfigKey(key));
}

/** A stored value parsed with its key's schema, or undefined if invalid. */
function parseStored<K extends OrganizationConfigKey>(
  organizationId: string,
  key: K,
  stored: string,
): { value: ConfigValue<K> } | undefined {
  const result = decodeConfigValue(getConfigDefinition(key), stored);
  if (result.success) return { value: result.data };
  console.warn(
    `Ignoring invalid config ${key} for organization ${organizationId}: ${result.error.message}`,
  );
  return undefined;
}

/**
 * Each key's value: the stored value, or the key's default when there's no
 * row or the row doesn't match the schema.
 */
async function get<K extends OrganizationConfigKey>(
  organizationId: string,
  keys: readonly K[],
): Promise<ConfigValues<K>> {
  const wanted = knownKeys(keys);
  const rows = await readRows(organizationId, wanted);
  const values: Partial<ConfigValues<K>> = {};
  for (const key of wanted) {
    const stored = rows.get(key);
    const parsed =
      stored === undefined
        ? undefined
        : parseStored(organizationId, key, stored);
    values[key] = parsed ? parsed.value : getConfigDefinition(key).default;
  }
  return values as ConfigValues<K>;
}

/**
 * Only the keys the organization has set, with valid values. For callers that
 * treat "never configured" differently from "configured to the default", such
 * as the theme.
 */
async function getExplicit<K extends OrganizationConfigKey>(
  organizationId: string,
  keys: readonly K[],
): Promise<Partial<ConfigValues<K>>> {
  const wanted = knownKeys(keys);
  const rows = await readRows(organizationId, wanted);
  const values: Partial<ConfigValues<K>> = {};
  for (const key of wanted) {
    const stored = rows.get(key);
    if (stored === undefined) continue;
    const parsed = parseStored(organizationId, key, stored);
    if (parsed) values[key] = parsed.value;
  }
  return values;
}

async function getOne<K extends OrganizationConfigKey>(
  organizationId: string,
  key: K,
): Promise<ConfigValue<K>> {
  const values = await get(organizationId, [key]);
  return values[key];
}

/**
 * Validates and stores a value. Takes a typed value or its stored text form
 * ("true", a JSON string), so seed scripts and older clients keep working.
 * Storing null deletes the row. Throws ConfigValidationError.
 */
async function set(
  organizationId: string,
  key: OrganizationConfigKey,
  input: unknown,
): Promise<void> {
  if (!isConfigKey(key)) {
    throw new ConfigValidationError(key, "Invalid key");
  }
  const result = decodeConfigValue(getConfigDefinition(key), input);
  if (!result.success) throw result.error;
  if (result.data === null) {
    await clear(organizationId, key);
    return;
  }

  const value = encodeConfigValue(result.data);
  // organization_config has no unique (organization_id, key) index to upsert
  // on, so update the row if there is one.
  const where = and(
    eq(organizationConfig.organizationId, organizationId),
    eq(organizationConfig.key, key),
  );
  const updated = await db
    .update(organizationConfig)
    .set({ value })
    .where(where)
    .returning({ id: organizationConfig.id });
  if (updated.length > 0) return;

  await db
    .insert(organizationConfig)
    .values({ id: randomUUID(), organizationId, key, value });
}

/** Deletes a key's row, so the key goes back to its default. */
async function clear(
  organizationId: string,
  key: OrganizationConfigKey,
): Promise<void> {
  await db
    .delete(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, key),
      ),
    );
}

export const configStore = { get, getExplicit, getOne, set, clear };
