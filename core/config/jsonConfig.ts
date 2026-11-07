import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import db from "@/core/db";
import {
  organizationConfig,
  OrganizationConfigKey,
} from "@/core/config/schema";

/** The raw stored value for a key, or undefined when there's no row. */
export async function getStoredConfigValue(
  organizationId: string,
  key: OrganizationConfigKey,
) {
  const [row] = await db
    .select({ value: organizationConfig.value })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, key),
      ),
    )
    .limit(1);

  return row?.value;
}

/** Stores a raw value for a key, replacing any existing row. */
export async function setStoredConfigValue(
  organizationId: string,
  key: OrganizationConfigKey,
  value: string,
) {
  const [existing] = await db
    .select({ id: organizationConfig.id })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, key),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(organizationConfig)
      .set({ value })
      .where(
        and(
          eq(organizationConfig.organizationId, organizationId),
          eq(organizationConfig.key, key),
        ),
      );
    return;
  }

  await db.insert(organizationConfig).values({
    id: randomUUID(),
    organizationId,
    key,
    value,
  });
}

/** Removes a key's row, so the key goes back to its default. */
export async function clearStoredConfigValue(
  organizationId: string,
  key: OrganizationConfigKey,
) {
  await db
    .delete(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, key),
      ),
    );
}

/**
 * Get/set for a config value stored as JSON. `get` returns `fallback` when
 * nothing (or something invalid) is stored; `set` rejects values that don't
 * match the schema.
 */
export function jsonConfig<T>(
  key: OrganizationConfigKey,
  label: string,
  schema: z.ZodType<T>,
  fallback: T,
) {
  return {
    async get(organizationId: string): Promise<T> {
      const value = await getStoredConfigValue(organizationId, key);
      if (!value) return fallback;
      try {
        return schema.parse(JSON.parse(value));
      } catch {
        return fallback;
      }
    },
    async set(organizationId: string, value: string) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        throw new Error(`Invalid JSON for ${label}`);
      }
      const result = schema.safeParse(parsed);
      if (!result.success) {
        const [issue] = result.error.issues;
        const where = issue.path.length ? ` (${issue.path.join(".")})` : "";
        throw new Error(`Invalid ${label}${where}: ${issue.message}`);
      }
      await setStoredConfigValue(
        organizationId,
        key,
        JSON.stringify(result.data),
      );
    },
  };
}
