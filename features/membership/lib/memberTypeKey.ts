import { z } from "zod";

declare const brand: unique symbol;
export type MemberTypeKey = string & { readonly [brand]: "MemberTypeKey" };

const MEMBER_TYPE_KEY_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;
const MAX_MEMBER_TYPE_KEY_LENGTH = 40;

export const RESERVED_MEMBER_TYPE_KEYS = [
  "admin",
  "member",
  "default",
] as const;

const reservedMemberTypeKeys = new Set<string>(RESERVED_MEMBER_TYPE_KEYS);

export const isMemberTypeKey = (value: string): value is MemberTypeKey =>
  MEMBER_TYPE_KEY_PATTERN.test(value) && !reservedMemberTypeKeys.has(value);

const toMemberTypeKey = (value: string): MemberTypeKey => {
  if (!isMemberTypeKey(value)) throw new Error("Invalid member type key");
  return value;
};

export const MemberTypeKeySchema = z
  .string()
  .regex(MEMBER_TYPE_KEY_PATTERN)
  .refine((key) => !reservedMemberTypeKeys.has(key), "Reserved")
  .transform(toMemberTypeKey);

const slugifyLabel = (label: string): string => {
  let slug = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_MEMBER_TYPE_KEY_LENGTH);

  if (slug === "") return "type-1";

  if (/^[0-9]/.test(slug)) {
    slug = `type-${slug}`;
    if (slug.length > MAX_MEMBER_TYPE_KEY_LENGTH)
      slug = slug.slice(0, MAX_MEMBER_TYPE_KEY_LENGTH);
    return slug;
  }

  if (slug.length > MAX_MEMBER_TYPE_KEY_LENGTH)
    slug = slug.slice(0, MAX_MEMBER_TYPE_KEY_LENGTH);
  return slug.replace(/-+$/g, "");
};

const isKeyTakenOrReserved = (
  key: string,
  takenKeys: ReadonlySet<string>,
): boolean => reservedMemberTypeKeys.has(key) || takenKeys.has(key);

const withSuffix = (base: string, suffix: number): string => {
  const suffixText = `-${suffix}`;
  const maxBaseLength = MAX_MEMBER_TYPE_KEY_LENGTH - suffixText.length;
  const trimmedBase =
    base.length > maxBaseLength
      ? base.slice(0, maxBaseLength).replace(/-+$/g, "")
      : base;
  return `${trimmedBase}${suffixText}`;
};

export const keyFromLabel = (
  label: string,
  takenKeys: Iterable<MemberTypeKey>,
): MemberTypeKey => {
  const taken = new Set<string>([...takenKeys]);
  const base = slugifyLabel(label);
  if (!isKeyTakenOrReserved(base, taken)) return toMemberTypeKey(base);

  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = withSuffix(base, suffix);
    if (!isKeyTakenOrReserved(candidate, taken))
      return toMemberTypeKey(candidate);
  }

  throw new Error("Unable to generate a unique member type key");
};
