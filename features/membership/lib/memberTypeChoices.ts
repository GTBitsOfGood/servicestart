import type { MemberTypeKey } from "@/features/membership/lib/memberTypeKey";

export type MemberTypeChoice = {
  option: string;
  value: MemberTypeKey | null;
};

/**
 * Choices for a dropdown that identifies options by their text. A type whose
 * text matches any other option, built-in or reserved, gets its key appended,
 * and then a number if that text is taken too (another type can be labeled
 * "Lead (lead)"), so every option's text is distinct.
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
  const isUnique = (text: string) => counts.get(text) === 1;
  // Texts already shown as they are: unique type labels, built-ins, reserved.
  const taken = new Set<string>([
    ...reserved,
    ...builtIns.map((choice) => choice.option),
    ...types.map((type) => type.text).filter(isUnique),
  ]);
  return [
    ...builtIns,
    ...types.map(({ key, text }) => {
      if (isUnique(text)) return { option: text, value: key };
      let option = `${text} (${key})`;
      for (let n = 2; taken.has(option); n++) option = `${text} (${key}) ${n}`;
      taken.add(option);
      return { option, value: key };
    }),
  ];
}
