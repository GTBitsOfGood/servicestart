// @vitest-environment node
import { describe, expect, it } from "vitest";
import { memberTypeChoices } from "@/features/membership/lib/memberTypeChoices";
import type { MemberTypeKey } from "@/features/membership/lib/memberTypeKey";

const key = (value: string) => value as MemberTypeKey;

describe("memberTypeChoices", () => {
  it("keeps the built-in null choice findable by its text", () => {
    const choices = memberTypeChoices({
      types: [{ key: key("staff"), text: "Staff" }],
      builtIns: [{ option: "No type", value: null }],
    });

    expect(choices.find((choice) => choice.option === "No type")).toEqual({
      option: "No type",
      value: null,
    });
  });

  it("gives every option distinct text when a type matches a built-in or reserved option", () => {
    const choices = memberTypeChoices({
      types: [
        { key: key("set-type"), text: "Set type" },
        { key: key("all"), text: "No type" },
        { key: key("staff"), text: "Staff" },
      ],
      builtIns: [{ option: "No type", value: null }],
      reserved: ["Set type"],
    });

    expect(choices).toEqual([
      { option: "No type", value: null },
      { option: "Set type (set-type)", value: key("set-type") },
      { option: "No type (all)", value: key("all") },
      { option: "Staff", value: key("staff") },
    ]);
  });

  it("appends keys to types that share a label", () => {
    const choices = memberTypeChoices({
      types: [
        { key: key("lead"), text: "Lead" },
        { key: key("lead-2"), text: "Lead" },
      ],
      builtIns: [],
    });

    expect(choices.map((choice) => choice.option)).toEqual([
      "Lead (lead)",
      "Lead (lead-2)",
    ]);
  });
});
