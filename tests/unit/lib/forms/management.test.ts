// @vitest-environment node
import { describe, expect, it } from "vitest";
import { csvCell, suggestFormId } from "@/lib/forms/management";

describe("CSV serialization", () => {
  it.each(["=1+1", "+formula", "-formula", "@SUM(A1)"])(
    "neutralizes %s",
    (value) => {
      expect(csvCell(value)).toBe(`"'${value}"`);
    },
  );
  it("quotes commas, newlines and quotes without changing text or leading zeroes", () => {
    expect(csvCell('Hello, "world"\nnext')).toBe('"Hello, ""world""\nnext"');
    expect(csvCell("001234")).toBe('"001234"');
    expect(csvCell(0)).toBe('"0"');
  });
});

describe("form ID suggestions", () => {
  it("normalizes titles and respects the contract length", () => {
    expect(suggestFormId("  Café Application 2027! ")).toBe(
      "cafe-application-2027",
    );
    expect(suggestFormId("x".repeat(100))).toHaveLength(64);
  });
});
