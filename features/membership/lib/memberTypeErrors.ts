export type MemberTypeErrorReason = "invalid" | "not_found" | "in_use";

export type MemberTypeInUseCounts = {
  members: number;
  forms: number;
  label: string;
};

const countLabel = (count: number, singular: string, plural: string): string =>
  `${count} ${count === 1 ? singular : plural}`;

export const memberTypeInUseMessage = (
  members: number,
  forms: number,
  label: string,
): string =>
  `${countLabel(members, "member", "members")} and ${countLabel(forms, "form", "forms")} use ${label}.`;

export class MemberTypeError extends Error {
  constructor(
    public readonly reason: MemberTypeErrorReason,
    message: string,
    public readonly inUse?: MemberTypeInUseCounts,
  ) {
    super(message);
    this.name = "MemberTypeError";
  }
}

export const memberTypeInUseError = (
  members: number,
  forms: number,
  label: string,
): MemberTypeError =>
  new MemberTypeError("in_use", memberTypeInUseMessage(members, forms, label), {
    members,
    forms,
    label,
  });
