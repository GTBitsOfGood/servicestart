import { and, asc, count, eq, inArray, max, sql } from "drizzle-orm";
import { z } from "zod";
import db from "@/core/db";
import {
  AUDIENCE_KEYED_CONFIG_KEYS,
  forms,
  memberTypes,
  members,
  organizationConfig,
} from "@/core/db/schema";
import {
  MemberTypeError,
  memberTypeInUseError,
} from "@/features/membership/lib/memberTypeErrors";
import {
  keyFromLabel,
  MemberTypeKeySchema,
  type MemberTypeKey,
} from "@/features/membership/lib/memberTypeKey";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type MemberTypeRow = {
  key: MemberTypeKey;
  label: string;
  pluralLabel: string;
  position: number;
  isSignupDefault: boolean;
};

const UpdateMemberTypeSchema = z.strictObject({
  label: z.string().trim().min(1),
  pluralLabel: z.string().trim().min(1),
});

const rowColumns = {
  key: memberTypes.key,
  label: memberTypes.label,
  pluralLabel: memberTypes.pluralLabel,
  position: memberTypes.position,
  isSignupDefault: memberTypes.isSignupDefault,
};

const toRow = (row: {
  key: string;
  label: string;
  pluralLabel: string;
  position: number;
  isSignupDefault: boolean;
}): MemberTypeRow => ({
  key: MemberTypeKeySchema.parse(row.key),
  label: row.label,
  pluralLabel: row.pluralLabel,
  position: row.position,
  isSignupDefault: row.isSignupDefault,
});

const isPgError = (
  error: unknown,
  code: string,
  constraint?: string,
): boolean => {
  let cause: unknown = error;
  while (cause instanceof Error) {
    if (
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      cause.code === code &&
      (!constraint ||
        ("constraint" in cause && cause.constraint === constraint))
    ) {
      return true;
    }
    cause = cause.cause;
  }
  return false;
};

async function orgKeys(
  organizationId: string,
  tx: Transaction | typeof db = db,
): Promise<MemberTypeKey[]> {
  const rows = await tx
    .select({ key: memberTypes.key })
    .from(memberTypes)
    .where(eq(memberTypes.organizationId, organizationId));
  return rows.map((row) => MemberTypeKeySchema.parse(row.key));
}

async function list(organizationId: string): Promise<MemberTypeRow[]> {
  const rows = await db
    .select(rowColumns)
    .from(memberTypes)
    .where(eq(memberTypes.organizationId, organizationId))
    .orderBy(asc(memberTypes.position), asc(memberTypes.key));
  return rows.map(toRow);
}

async function findByKey(
  organizationId: string,
  key: MemberTypeKey,
): Promise<MemberTypeRow | null> {
  const [row] = await db
    .select(rowColumns)
    .from(memberTypes)
    .where(
      and(
        eq(memberTypes.organizationId, organizationId),
        eq(memberTypes.key, key),
      ),
    )
    .limit(1);
  return row ? toRow(row) : null;
}

/**
 * Locks the row against deletion until `tx` ends, so a caller can insert a
 * member with this type without racing `delete`.
 */
async function getSignupDefault(
  organizationId: string,
  tx: Transaction | typeof db = db,
): Promise<MemberTypeRow | null> {
  const [row] = await tx
    .select(rowColumns)
    .from(memberTypes)
    .where(
      and(
        eq(memberTypes.organizationId, organizationId),
        eq(memberTypes.isSignupDefault, true),
      ),
    )
    .limit(1)
    .for("key share");
  return row ? toRow(row) : null;
}

async function findUnknownKeys(
  organizationId: string,
  keys: MemberTypeKey[],
  tx: Transaction | typeof db = db,
): Promise<MemberTypeKey[]> {
  if (keys.length === 0) return [];
  const rows = await tx
    .select({ key: memberTypes.key })
    .from(memberTypes)
    .where(
      and(
        eq(memberTypes.organizationId, organizationId),
        inArray(memberTypes.key, keys),
      ),
    );
  const known = new Set(rows.map((row) => row.key));
  return keys.filter((key) => !known.has(key));
}

async function nextPosition(
  organizationId: string,
  tx: Transaction | typeof db,
): Promise<number> {
  const [row] = await tx
    .select({ value: max(memberTypes.position) })
    .from(memberTypes)
    .where(eq(memberTypes.organizationId, organizationId));
  return (row?.value ?? -1) + 1;
}

async function insertType(
  organizationId: string,
  input: { label: string; pluralLabel: string },
  tx: Transaction | typeof db = db,
): Promise<MemberTypeRow> {
  const taken = await orgKeys(organizationId, tx);
  const key = keyFromLabel(input.label, taken);
  const position = await nextPosition(organizationId, tx);
  const [row] = await tx
    .insert(memberTypes)
    .values({
      organizationId,
      key,
      label: input.label,
      pluralLabel: input.pluralLabel,
      position,
      isSignupDefault: false,
    })
    .returning(rowColumns);
  return toRow(row);
}

async function create(
  organizationId: string,
  input: { label: string; pluralLabel: string },
): Promise<MemberTypeRow> {
  try {
    return await insertType(organizationId, input);
  } catch (error) {
    if (isPgError(error, "23505", "member_types_organization_id_key_unique")) {
      return await insertType(organizationId, input);
    }
    throw error;
  }
}

async function ensure(
  organizationId: string,
  input: {
    key: MemberTypeKey;
    label: string;
    pluralLabel: string;
    isSignupDefault: boolean;
  },
): Promise<MemberTypeRow> {
  const existing = await findByKey(organizationId, input.key);
  if (existing) {
    if (input.isSignupDefault && !existing.isSignupDefault) {
      await setSignupDefault(organizationId, input.key);
    }
    const row = await findByKey(organizationId, input.key);
    if (!row) throw new MemberTypeError("not_found", "Member type not found");
    return row;
  }

  return await db.transaction(async (tx) => {
    if (input.isSignupDefault) {
      await tx
        .update(memberTypes)
        .set({ isSignupDefault: false })
        .where(
          and(
            eq(memberTypes.organizationId, organizationId),
            eq(memberTypes.isSignupDefault, true),
          ),
        );
    }

    const position = await nextPosition(organizationId, tx);
    const [row] = await tx
      .insert(memberTypes)
      .values({
        organizationId,
        key: input.key,
        label: input.label,
        pluralLabel: input.pluralLabel,
        position,
        isSignupDefault: input.isSignupDefault,
      })
      .returning(rowColumns);
    return toRow(row);
  });
}

async function update(
  organizationId: string,
  key: MemberTypeKey,
  input: z.input<typeof UpdateMemberTypeSchema>,
): Promise<MemberTypeRow> {
  let parsed: z.infer<typeof UpdateMemberTypeSchema>;
  try {
    parsed = UpdateMemberTypeSchema.parse(input);
  } catch {
    throw new MemberTypeError("invalid", "Invalid member type update");
  }

  const [row] = await db
    .update(memberTypes)
    .set({
      label: parsed.label,
      pluralLabel: parsed.pluralLabel,
    })
    .where(
      and(
        eq(memberTypes.organizationId, organizationId),
        eq(memberTypes.key, key),
      ),
    )
    .returning(rowColumns);

  if (!row) throw new MemberTypeError("not_found", "Member type not found");
  return toRow(row);
}

async function reorder(
  organizationId: string,
  keys: MemberTypeKey[],
): Promise<MemberTypeRow[]> {
  const rows = await list(organizationId);
  const existing = new Set(rows.map((row) => row.key));
  const uniqueKeys = new Set(keys);
  if (
    keys.length !== rows.length ||
    uniqueKeys.size !== keys.length ||
    keys.some((key) => !existing.has(key))
  ) {
    throw new MemberTypeError(
      "invalid",
      "Keys must match this organization's types",
    );
  }

  await db.transaction(async (tx) => {
    for (const [position, key] of keys.entries()) {
      await tx
        .update(memberTypes)
        .set({ position })
        .where(
          and(
            eq(memberTypes.organizationId, organizationId),
            eq(memberTypes.key, key),
          ),
        );
    }
  });

  return list(organizationId);
}

async function setSignupDefault(
  organizationId: string,
  key: MemberTypeKey | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(memberTypes)
      .set({ isSignupDefault: false })
      .where(
        and(
          eq(memberTypes.organizationId, organizationId),
          eq(memberTypes.isSignupDefault, true),
        ),
      );

    if (key === null) return;

    const [updated] = await tx
      .update(memberTypes)
      .set({ isSignupDefault: true })
      .where(
        and(
          eq(memberTypes.organizationId, organizationId),
          eq(memberTypes.key, key),
        ),
      )
      .returning(rowColumns);

    if (!updated)
      throw new MemberTypeError("not_found", "Member type not found");
  });
}

async function countUsage(
  tx: Transaction | typeof db,
  organizationId: string,
  key: MemberTypeKey,
  label: string,
): Promise<{ members: number; forms: number; label: string }> {
  const [[memberRow], [formRow]] = await Promise.all([
    tx
      .select({ count: count() })
      .from(members)
      .where(
        and(
          eq(members.organizationId, organizationId),
          eq(members.memberType, key),
        ),
      ),
    tx
      .select({ count: count() })
      .from(forms)
      .where(
        and(
          eq(forms.organizationId, organizationId),
          sql`(
            COALESCE(${forms.settings}->'assignedMemberTypes', '[]'::jsonb)
              @> to_jsonb(ARRAY[${key}]::text[])
            OR ${forms.settings}->>'acceptedMemberType' = ${key}
          )`,
        ),
      ),
  ]);

  return {
    members: Number(memberRow?.count ?? 0),
    forms: Number(formRow?.count ?? 0),
    label,
  };
}

async function usage(
  organizationId: string,
  key: MemberTypeKey,
): Promise<{ members: number; forms: number; label: string }> {
  const row = await findByKey(organizationId, key);
  if (!row) throw new MemberTypeError("not_found", "Member type not found");
  return countUsage(db, organizationId, key, row.label);
}

async function deleteType(
  organizationId: string,
  key: MemberTypeKey,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select(rowColumns)
        .from(memberTypes)
        .where(
          and(
            eq(memberTypes.organizationId, organizationId),
            eq(memberTypes.key, key),
          ),
        )
        .for("update");

      if (!row) throw new MemberTypeError("not_found", "Member type not found");

      const counts = await countUsage(tx, organizationId, key, row.label);
      if (counts.members > 0 || counts.forms > 0) {
        throw memberTypeInUseError(counts.members, counts.forms, counts.label);
      }

      await tx
        .delete(memberTypes)
        .where(
          and(
            eq(memberTypes.organizationId, organizationId),
            eq(memberTypes.key, key),
          ),
        );

      // A later type can reuse this key, and must not inherit these entries.
      await tx
        .update(organizationConfig)
        .set({
          value: sql`(${organizationConfig.value}::jsonb - ${key}::text)::text`,
        })
        .where(
          and(
            eq(organizationConfig.organizationId, organizationId),
            inArray(organizationConfig.key, [...AUDIENCE_KEYED_CONFIG_KEYS]),
            sql`${organizationConfig.value}::jsonb ? ${key}::text`,
          ),
        );
    });
  } catch (error) {
    if (error instanceof MemberTypeError) throw error;
    if (isPgError(error, "23503")) {
      const row = await findByKey(organizationId, key);
      if (row) {
        const counts = await usage(organizationId, key);
        throw memberTypeInUseError(counts.members, counts.forms, counts.label);
      }
    }
    throw error;
  }
}

export const MemberTypeService = {
  list,
  findByKey,
  getSignupDefault,
  findUnknownKeys,
  create,
  ensure,
  update,
  reorder,
  setSignupDefault,
  usage,
  delete: deleteType,
};
