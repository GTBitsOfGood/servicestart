import { OrganizationConfigKey } from "@/lib/schema";

export const THEME_FONT_VALUES = [
  "fredoka",
  "lexend",
  "open-sans",
  "visby",
] as const;

export type ThemeFont = (typeof THEME_FONT_VALUES)[number];

export const CORNER_STYLE_VALUES = ["square", "rounded", "pill"] as const;

export type CornerStyle = (typeof CORNER_STYLE_VALUES)[number];

export const CONTROL_RADIUS_BY_CORNER_STYLE = {
  square: "0px",
  rounded: "0.25rem",
  pill: "32px",
} as const satisfies Record<CornerStyle, string>;

export const FONT_FAMILY_VARIABLE_BY_THEME_FONT = {
  fredoka: "var(--font-family-fredoka)",
  lexend: "var(--font-family-lexend)",
  "open-sans": "var(--font-family-open-sans)",
  visby: "var(--font-family-visby)",
} as const satisfies Record<ThemeFont, string>;

const LIGHT_BRAND_FOREGROUND = "#FFFFFF";
const DARK_BRAND_FOREGROUND = "#000000";

export const DEFAULT_APP_THEME = {
  primaryColor: "#FC5B43",
  secondaryColor: "#FB3552",
  backgroundColor: "#FFFFFF",
  textColor: "#22070B",
  displayFont: "visby",
  headingFont: "visby",
  bodyFont: "open-sans",
  cornerStyle: "rounded",
  radiusControl: CONTROL_RADIUS_BY_CORNER_STYLE.rounded,
  brandForeground: LIGHT_BRAND_FOREGROUND,
} as const satisfies ResolvedOrganizationTheme;

export type ResolvedOrganizationTheme = {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  displayFont: ThemeFont;
  headingFont: ThemeFont;
  bodyFont: ThemeFont;
  cornerStyle: CornerStyle;
  radiusControl: string;
  brandForeground: string;
};

export const ORGANIZATION_THEME_CONFIG_KEYS = [
  OrganizationConfigKey.PrimaryColor,
  OrganizationConfigKey.SecondaryColor,
  OrganizationConfigKey.BackgroundColor,
  OrganizationConfigKey.TextColor,
  OrganizationConfigKey.DisplayFont,
  OrganizationConfigKey.HeadingFont,
  OrganizationConfigKey.BodyFont,
  OrganizationConfigKey.CornerStyle,
] as const;

export type OrganizationThemeConfigKey =
  (typeof ORGANIZATION_THEME_CONFIG_KEYS)[number];

export type OrganizationThemeConfig = Partial<
  Record<OrganizationThemeConfigKey, string>
>;

export function isHexColor(value: string): boolean {
  return /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);
}

export function assertHexColor(value: string): void {
  if (!isHexColor(value)) {
    throw new Error("Color must be a valid hex code");
  }
}

export function isThemeFont(value: string): value is ThemeFont {
  return THEME_FONT_VALUES.some((font) => font === value);
}

export function assertThemeFont(value: string): asserts value is ThemeFont {
  if (!isThemeFont(value)) {
    throw new Error(`Font must be one of: ${THEME_FONT_VALUES.join(", ")}`);
  }
}

export function isCornerStyle(value: string): value is CornerStyle {
  return CORNER_STYLE_VALUES.some((style) => style === value);
}

export function assertCornerStyle(value: string): asserts value is CornerStyle {
  if (!isCornerStyle(value)) {
    throw new Error(
      `Corner style must be one of: ${CORNER_STYLE_VALUES.join(", ")}`,
    );
  }
}

function expandHexColor(color: string): string {
  if (color.length === 4) {
    return `#${color
      .slice(1)
      .split("")
      .map((character) => character.repeat(2))
      .join("")}`;
  }

  return color;
}

function relativeLuminance(color: string): number {
  const expanded = expandHexColor(color);
  const channels = [1, 3, 5].map((start) =>
    Number.parseInt(expanded.slice(start, start + 2), 16),
  );

  const [red, green, blue] = channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function getContrastRatio(firstColor: string, secondColor: string) {
  assertHexColor(firstColor);
  assertHexColor(secondColor);

  const firstLuminance = relativeLuminance(firstColor);
  const secondLuminance = relativeLuminance(secondColor);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

export function getAccessibleBrandForeground(brandColor: string): string {
  assertHexColor(brandColor);

  const lightContrast = getContrastRatio(brandColor, LIGHT_BRAND_FOREGROUND);
  const darkContrast = getContrastRatio(brandColor, DARK_BRAND_FOREGROUND);

  return lightContrast >= darkContrast
    ? LIGHT_BRAND_FOREGROUND
    : DARK_BRAND_FOREGROUND;
}

function resolveColor(value: string | undefined, fallback: string): string {
  return value && isHexColor(value) ? value : fallback;
}

function resolveFont(
  value: string | undefined,
  fallback: ThemeFont,
): ThemeFont {
  return value && isThemeFont(value) ? value : fallback;
}

export function resolveOrganizationTheme(
  config: OrganizationThemeConfig,
): ResolvedOrganizationTheme {
  const configuredPrimary = config[OrganizationConfigKey.PrimaryColor];
  const hasConfiguredPrimary = Boolean(
    configuredPrimary && isHexColor(configuredPrimary),
  );
  const primaryColor = resolveColor(
    configuredPrimary,
    DEFAULT_APP_THEME.primaryColor,
  );
  const cornerStyleValue = config[OrganizationConfigKey.CornerStyle];
  const cornerStyle =
    cornerStyleValue && isCornerStyle(cornerStyleValue)
      ? cornerStyleValue
      : DEFAULT_APP_THEME.cornerStyle;

  return {
    primaryColor,
    secondaryColor: resolveColor(
      config[OrganizationConfigKey.SecondaryColor],
      DEFAULT_APP_THEME.secondaryColor,
    ),
    backgroundColor: resolveColor(
      config[OrganizationConfigKey.BackgroundColor],
      DEFAULT_APP_THEME.backgroundColor,
    ),
    textColor: resolveColor(
      config[OrganizationConfigKey.TextColor],
      DEFAULT_APP_THEME.textColor,
    ),
    displayFont: resolveFont(
      config[OrganizationConfigKey.DisplayFont],
      DEFAULT_APP_THEME.displayFont,
    ),
    headingFont: resolveFont(
      config[OrganizationConfigKey.HeadingFont],
      DEFAULT_APP_THEME.headingFont,
    ),
    bodyFont: resolveFont(
      config[OrganizationConfigKey.BodyFont],
      DEFAULT_APP_THEME.bodyFont,
    ),
    cornerStyle,
    radiusControl: CONTROL_RADIUS_BY_CORNER_STYLE[cornerStyle],
    // An organization with no configured primary keeps today's white button
    // text exactly. Once an organization chooses a primary, its foreground is
    // selected from black or white using WCAG contrast.
    brandForeground: hasConfiguredPrimary
      ? getAccessibleBrandForeground(primaryColor)
      : DEFAULT_APP_THEME.brandForeground,
  };
}

export function getOrganizationThemeCssVariables(
  config: OrganizationThemeConfig,
): Record<`--${string}`, string> {
  const theme = resolveOrganizationTheme(config);
  const hasCustomTheme = ORGANIZATION_THEME_CONFIG_KEYS.some(
    (key) => config[key] !== undefined,
  );
  const variables: Record<`--${string}`, string> = {
    "--color-brand-text": theme.primaryColor,
    "--color-brand-secondary": theme.secondaryColor,
    "--color-page-bg": theme.backgroundColor,
    "--color-page-text": theme.textColor,
    "--color-brand-foreground": theme.brandForeground,
    "--font-display": FONT_FAMILY_VARIABLE_BY_THEME_FONT[theme.displayFont],
    "--font-heading": FONT_FAMILY_VARIABLE_BY_THEME_FONT[theme.headingFont],
    "--font-body": FONT_FAMILY_VARIABLE_BY_THEME_FONT[theme.bodyFont],
    "--font-paragraph": FONT_FAMILY_VARIABLE_BY_THEME_FONT[theme.bodyFont],
    "--radius-control": theme.radiusControl,
  };

  if (hasCustomTheme) {
    // These compatibility tokens let existing app surfaces adopt an
    // organization's page colors without changing an unconfigured org's
    // current appearance.
    variables["--color-app-shell-bg"] = theme.backgroundColor;
    variables["--color-app-strong-text"] = theme.textColor;
    variables["--color-navbar-bg"] = theme.backgroundColor;
    variables["--color-mobile-navbar-bg"] = theme.backgroundColor;
    variables["--color-media-page-bg"] = theme.backgroundColor;
  }

  const configuredPrimary = config[OrganizationConfigKey.PrimaryColor];
  if (!configuredPrimary || !isHexColor(configuredPrimary)) {
    return variables;
  }

  const mixWithPage = (brandPercentage: number) =>
    `color-mix(in oklch, ${theme.primaryColor} ${brandPercentage}%, ${theme.backgroundColor})`;

  // With Visionaries' colors, these mixes resolve to approximately #7A4FA6
  // and #BAA4D7, close to the style guide's #7D52A1 and #C29BDC.
  return {
    ...variables,
    "--color-brand-stroke-strong": `color-mix(in srgb, ${theme.primaryColor} 80%, transparent)`,
    "--color-brand-stroke-weak": `color-mix(in srgb, ${theme.primaryColor} 20%, transparent)`,
    "--color-brand-hover": mixWithPage(80),
    "--color-brand-fill": `color-mix(in srgb, ${theme.primaryColor} 5%, transparent)`,
    "--color-brand-surface": mixWithPage(40),
    "--color-media-shadow": "var(--color-brand-hover)",
    "--color-media-notification-bg": theme.primaryColor,
    "--color-media-notification-border": "var(--color-brand-surface)",
  };
}
