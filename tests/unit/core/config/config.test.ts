// @vitest-environment node
import { describe, expect, it } from "vitest";
import { containsHtmlTag, description, tagline } from "@/core/config/config";

describe("containsHtmlTag", () => {
  it.each([
    "<b>bold</b>",
    "Hi <br>",
    '<a href="x">link</a>',
    "<a title='>'>",
    // A quoted value may contain ">", and stray quotes may follow it.
    '<a title=">">',
    '<a href="x"">',
    '<"a""b">',
    "5 < 6 > 4",
    "<<a>",
  ])("finds a tag in %j", (text) => {
    expect(containsHtmlTag(text)).toBe(true);
  });

  it.each([
    "",
    "Visionaries to the Throne",
    "<>",
    "a < b",
    "a > b",
    // An unclosed quote swallows the ">".
    '<a"b>',
    "<'>",
    '<a href="x>',
  ])("finds no tag in %j", (text) => {
    expect(containsHtmlTag(text)).toBe(false);
  });

  it("stays fast on long runs of quotes", () => {
    const started = performance.now();
    expect(containsHtmlTag(`<${'""'.repeat(100_000)}`)).toBe(false);
    expect(containsHtmlTag(`<${"''".repeat(100_000)}>`)).toBe(true);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("rejects tags in the tagline and description", () => {
    expect(tagline.schema.safeParse("<b>Hi</b>").success).toBe(false);
    expect(tagline.schema.safeParse("Hi").success).toBe(true);
    expect(
      description.schema.safeParse(`<${'""'.repeat(100_000)}`).success,
    ).toBe(false);
  });
});
