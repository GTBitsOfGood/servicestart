// @vitest-environment node
import { describe, expect, it } from "vitest";
import { OrganizationConfigKey } from "@/lib/schema";
import {
  assertCornerStyle,
  assertHexColor,
  assertThemeFont,
  CONTROL_RADIUS_BY_CORNER_STYLE,
  DEFAULT_APP_THEME,
  getAccessibleBrandForeground,
  getContrastRatio,
  getOrganizationThemeCssVariables,
  resolveOrganizationTheme,
} from "@/lib/theme";

describe("resolveOrganizationTheme", () => {
  it("returns today's application theme when no theme config is present", () => {
    expect(resolveOrganizationTheme({})).toEqual(DEFAULT_APP_THEME);
  });

  it("resolves the Visionaries theme from organization config", () => {
    expect(
      resolveOrganizationTheme({
        [OrganizationConfigKey.PrimaryColor]: "#5C218C",
        [OrganizationConfigKey.BackgroundColor]: "#FFFEF1",
        [OrganizationConfigKey.TextColor]: "#373444",
        [OrganizationConfigKey.DisplayFont]: "fredoka",
        [OrganizationConfigKey.HeadingFont]: "lexend",
        [OrganizationConfigKey.BodyFont]: "lexend",
        [OrganizationConfigKey.CornerStyle]: "pill",
      }),
    ).toEqual({
      ...DEFAULT_APP_THEME,
      primaryColor: "#5C218C",
      backgroundColor: "#FFFEF1",
      textColor: "#373444",
      displayFont: "fredoka",
      headingFont: "lexend",
      bodyFont: "lexend",
      cornerStyle: "pill",
      radiusControl: CONTROL_RADIUS_BY_CORNER_STYLE.pill,
      brandForeground: "#FFFFFF",
    });
  });

  it("falls back safely when stored values are invalid", () => {
    expect(
      resolveOrganizationTheme({
        [OrganizationConfigKey.BackgroundColor]: "cream",
        [OrganizationConfigKey.HeadingFont]: "Comic Sans",
        [OrganizationConfigKey.CornerStyle]: "extra-round",
      }),
    ).toEqual(DEFAULT_APP_THEME);
  });
});

describe("theme config validation", () => {
  it("accepts supported values", () => {
    expect(() => assertHexColor("#5C218C")).not.toThrow();
    expect(() => assertHexColor("#FFF")).not.toThrow();
    expect(() => assertThemeFont("lexend")).not.toThrow();
    expect(() => assertCornerStyle("pill")).not.toThrow();
  });

  it("rejects unsupported values", () => {
    expect(() => assertHexColor("purple")).toThrow(
      "Color must be a valid hex code",
    );
    expect(() => assertThemeFont("comic-sans")).toThrow("Font must be one of");
    expect(() => assertCornerStyle("extra-round")).toThrow(
      "Corner style must be one of",
    );
  });
});

describe("brand foreground contrast", () => {
  it("chooses white for Visionaries purple", () => {
    const foreground = getAccessibleBrandForeground("#5C218C");

    expect(foreground).toBe("#FFFFFF");
    expect(getContrastRatio("#5C218C", foreground)).toBeGreaterThanOrEqual(4.5);
  });

  it("chooses black for a light brand color", () => {
    const foreground = getAccessibleBrandForeground("#FFFEF1");

    expect(foreground).toBe("#000000");
    expect(getContrastRatio("#FFFEF1", foreground)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("getOrganizationThemeCssVariables", () => {
  it("keeps today's derived token defaults when no primary is configured", () => {
    const variables = getOrganizationThemeCssVariables({});

    expect(variables["--color-brand-text"]).toBe("#FC5B43");
    expect(variables["--color-page-bg"]).toBe("#FFFFFF");
    expect(variables["--color-brand-foreground"]).toBe("#FFFFFF");
    expect(variables["--color-brand-hover"]).toBeUndefined();
    expect(variables["--color-app-shell-bg"]).toBeUndefined();
  });

  it("creates server-ready variables for Visionaries", () => {
    const variables = getOrganizationThemeCssVariables({
      [OrganizationConfigKey.PrimaryColor]: "#5C218C",
      [OrganizationConfigKey.BackgroundColor]: "#FFFEF1",
      [OrganizationConfigKey.TextColor]: "#373444",
      [OrganizationConfigKey.DisplayFont]: "fredoka",
      [OrganizationConfigKey.HeadingFont]: "lexend",
      [OrganizationConfigKey.BodyFont]: "lexend",
      [OrganizationConfigKey.CornerStyle]: "pill",
    });

    expect(variables).toMatchObject({
      "--color-brand-text": "#5C218C",
      "--color-page-bg": "#FFFEF1",
      "--color-page-text": "#373444",
      "--color-brand-foreground": "#FFFFFF",
      "--font-display": "var(--font-family-fredoka)",
      "--font-heading": "var(--font-family-lexend)",
      "--font-paragraph": "var(--font-family-lexend)",
      "--radius-control": "32px",
      "--color-media-notification-bg": "#5C218C",
      "--color-app-shell-bg": "#FFFEF1",
      "--color-app-strong-text": "#373444",
      "--color-navbar-bg": "#FFFEF1",
      "--color-mobile-navbar-bg": "#FFFEF1",
      "--color-media-page-bg": "#FFFEF1",
    });
    expect(variables["--color-brand-hover"]).toBe(
      "color-mix(in oklch, #5C218C 80%, #FFFEF1)",
    );
    expect(variables["--color-brand-surface"]).toBe(
      "color-mix(in oklch, #5C218C 40%, #FFFEF1)",
    );
  });
});
