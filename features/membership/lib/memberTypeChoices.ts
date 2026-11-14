import type { MemberTypeKey } from "@/features/membership/lib/memberTypeKey";

export type MemberTypeChoice = {
  option: string;
  value: MemberTypeKey | null;
};

/**
 * Choices for a dropdown that identifies options by their text. A type whose
 * text matches any other option, built-in or reserved, gets its key appended.
 */
export function memberTypeChoices({
  types,
  builtIns,
  reserved = [],
}: {
  types: readonly { key: MemberTypeKey; text: string }[];
  builtIns: readonly MemberTypeChoice[];
  reserved?: readonly string[];
}): MemberTypeChoice[] {
  const counts = new Map<string, number>();
  for (const text of [
    ...reserved,
    ...builtIns.map((choice) => choice.option),
    ...types.map((type) => type.text),
  ]) {
    counts.set(text, (counts.get(text) ?? 0) + 1);
  }
  return [
    ...builtIns,
    ...types.map(({ key, text }) => ({
      option: (counts.get(text) ?? 0) > 1 ? `${text} (${key})` : text,
      value: key,
    })),
  ];
}
