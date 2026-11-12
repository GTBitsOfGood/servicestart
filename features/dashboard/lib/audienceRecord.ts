import type { MemberTypeKey } from "@/features/membership";

const RESERVED_AUDIENCE_KEYS = ["default", "admin", "member"] as const;

/** Drops audience entries that are not reserved or in the org's current type keys. */
export const pruneAudienceRecord = <T extends Record<string, unknown>>(
  record: T,
  keys: readonly MemberTypeKey[],
): Partial<T> => {
  const allowed = new Set<string>([...RESERVED_AUDIENCE_KEYS, ...keys]);
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => allowed.has(key)),
  ) as Partial<T>;
};
