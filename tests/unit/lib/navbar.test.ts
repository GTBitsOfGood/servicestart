// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isNoNavbarPage, matchesPage, NO_NAVBAR_PAGES } from "@/lib/navbar";

describe(matchesPage, () => {
  const pages = ["/login", "/forms/"];

  it("matches any path under an entry ending in /", () => {
    expect(matchesPage("/forms/abc", pages)).toBe(true);
    expect(matchesPage("/forms/camp-application-2027/edit", pages)).toBe(true);
  });

  it("doesn't match a path that only shares the prefix's letters", () => {
    expect(matchesPage("/formsabc", pages)).toBe(false);
    expect(matchesPage("/forms", pages)).toBe(false);
  });

  it("matches other entries exactly", () => {
    expect(matchesPage("/login", pages)).toBe(true);
    expect(matchesPage("/login/help", pages)).toBe(false);
    expect(matchesPage("/loginx", pages)).toBe(false);
  });
});

describe(isNoNavbarPage, () => {
  it.each(NO_NAVBAR_PAGES)("hides the navbar on %s", (page) => {
    expect(isNoNavbarPage(page)).toBe(true);
  });

  it("shows the navbar elsewhere", () => {
    expect(isNoNavbarPage("/")).toBe(false);
    expect(isNoNavbarPage("/events")).toBe(false);
  });
});
