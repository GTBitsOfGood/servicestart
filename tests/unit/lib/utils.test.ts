// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getRedirectPath } from "@/lib/utils";

describe("getRedirectPath", () => {
  it.each([
    [
      "?redirect=%2Fforms%2Fcamp-application-2027",
      "/forms/camp-application-2027",
    ],
    ["?redirect=%2Fforms%2Fapp%3Fpreview%3D1", "/forms/app?preview=1"],
    ["?redirect=/events", "/events"],
  ])("returns the path in %s", (search, path) => {
    expect(getRedirectPath(search)).toBe(path);
  });

  it.each([
    "",
    "?redirect=",
    "?redirect=https%3A%2F%2Fevil.com",
    "?redirect=%2F%2Fevil.com",
    "?redirect=%2F%5Cevil.com",
    "?redirect=%2F%09%2Fevil.com",
    "?redirect=%2F%0A%2Fevil.com",
    "?redirect=%2F%0D%2Fevil.com",
    "?redirect=%2F%5C%09evil.com",
    "?redirect=javascript%3Aalert(1)",
  ])("falls back to the home page for %j", (search) => {
    expect(getRedirectPath(search)).toBe("/");
  });
});
