import type { z } from "zod";
import type { OrganizationConfigKey } from "@/core/config/schema";

/*
 * Config definitions: each key's schema, default, and audience. They hold only
 * Zod schemas and plain values, so client code can import them; the server's
 * store (store.ts) reads and writes rows with them.
 *
 * Values are stored as text. A string value is stored as is ("#FD8033",
 * "inter"); anything else is stored as JSON ("true", "{...}"). Reading tries
 * the schema on the stored text first, then on the text parsed as JSON. So a
 * schema can't accept both a string and a non-string: keep each key one type.
 */

/** Who may read a key through GET /api/organizationConfig. */
export type ConfigVisibility = "public" | "member" | "admin";

export type ConfigDefinition<
  K extends OrganizationConfigKey = OrganizationConfigKey,
  T = unknown,
> = {
  key: K;
  schema: z.ZodType<T>;
  default: T;
  visibility: ConfigVisibility;
  /** Names the key in error messages, as in "Invalid footer (ein): …". */
  label: string;
};

/**
 * Declares a config key. Writing `null` to a key whose schema allows it
 * deletes the row, so the key goes back to its default.
 */
export function defineConfig<
  const K extends OrganizationConfigKey,
  S extends z.ZodType,
>(definition: {
  key: K;
  schema: S;
  default: z.output<S>;
  visibility: ConfigVisibility;
  label?: string;
}): ConfigDefinition<K, z.output<S>> {
  return {
    ...definition,
    // S is a ZodType whose output is z.output<S>; TS can't see that for a
    // generic S.
    schema: definition.schema as z.ZodType<z.output<S>>,
    label: definition.label ?? definition.key.replaceAll("_", " "),
  };
}

/** Collects definitions into an object keyed by config key. */
export function configGroup<
  const D extends readonly ConfigDefinition<OrganizationConfigKey, unknown>[],
>(...definitions: D): { [E in D[number] as E["key"]]: E } {
  return Object.fromEntries(
    definitions.map((definition) => [definition.key, definition]),
  ) as { [E in D[number] as E["key"]]: E };
}

/** A rejected config value. The message is safe to show to an admin. */
export class ConfigValidationError extends Error {
  constructor(
    readonly key: OrganizationConfigKey,
    message: string,
  ) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

export type DecodeResult<T> =
  | { success: true; data: T }
  | { success: false; error: ConfigValidationError };

// A schema that rejects a string with one of these expects JSON.
const STRUCTURED_TYPES = new Set(["object", "array", "record", "tuple", "map"]);

/**
 * Parses a value with its key's schema. Accepts a typed value (from the API
 * or the client) or the stored text form of one ("true", "{...}").
 */
export function decodeConfigValue<T>(
  definition: ConfigDefinition<OrganizationConfigKey, T>,
  input: unknown,
): DecodeResult<T> {
  const asIs = definition.schema.safeParse(input);
  if (asIs.success) return { success: true, data: asIs.data };
  if (typeof input !== "string") return failure(definition, asIs.error, input);

  // A string the schema rejects outright, rather than for its content, may be
  // the stored text of a boolean or an object.
  const [issue] = asIs.error.issues;
  const wantsAnotherType =
    asIs.error.issues.length === 1 &&
    issue.code === "invalid_type" &&
    issue.path.length === 0;
  if (!wantsAnotherType) return failure(definition, asIs.error, input);

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    if (STRUCTURED_TYPES.has(String(issue.expected))) {
      return {
        success: false,
        error: new ConfigValidationError(
          definition.key,
          `Invalid JSON for ${definition.label}`,
        ),
      };
    }
    return failure(definition, asIs.error, input);
  }

  const fromJson = definition.schema.safeParse(parsed);
  if (fromJson.success) return { success: true, data: fromJson.data };
  return failure(definition, fromJson.error, parsed);
}

function failure(
  definition: ConfigDefinition<OrganizationConfigKey, unknown>,
  error: z.ZodError,
  value: unknown,
): { success: false; error: ConfigValidationError } {
  const [issue] = error.issues;
  // A scalar's schema states its own rule ("Value must be 'true' or 'false'").
  // A structured value's message says which key and which field.
  const structured = typeof value === "object" && value !== null;
  const where = issue.path.length ? ` (${issue.path.join(".")})` : "";
  const message = structured
    ? `Invalid ${definition.label}${where}: ${issue.message}`
    : issue.message;
  return {
    success: false,
    error: new ConfigValidationError(definition.key, message),
  };
}

/** The text a validated value is stored as. */
export function encodeConfigValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** The visibilities a caller with this role may read. */
export function readableVisibilities(
  role: "admin" | "member" | null,
): ReadonlySet<ConfigVisibility> {
  if (role === "admin") return new Set(["public", "member", "admin"]);
  if (role === "member") return new Set(["public", "member"]);
  return new Set(["public"]);
}
