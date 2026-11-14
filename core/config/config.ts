import { z } from "zod";
import { DEFAULT_BRANDING } from "@/core/config/branding";
import { configGroup, defineConfig } from "@/core/config/defineConfig";
import { OrganizationConfigKey } from "@/core/config/schema";
import {
  CORNER_STYLE_VALUES,
  DEFAULT_APP_THEME,
  isHexColor,
  THEME_FONT_VALUES,
} from "@/core/config/theme";

// Branding and theme keys, which every feature shares.

const HTML_TAG = /<(?:"[^"]*"['"]*|'[^']*'['"]*|[^'">])+>/;

function plainText(name: string, maxLength: number) {
  return z
    .string()
    .max(maxLength, `${name} must be no longer than ${maxLength} characters`)
    .refine((value) => !HTML_TAG.test(value), {
      message: `${name} must not contain HTML tags`,
    });
}

const hexColor = z
  .string()
  .refine(isHexColor, { message: "Color must be a valid hex code" });

const themeFont = z.enum(THEME_FONT_VALUES, {
  error: `Font must be one of: ${THEME_FONT_VALUES.join(", ")}`,
});

// The signed-out pages read these before anyone logs in, and proxy.ts reads
// the tagline to check that an organization exists.

export const tagline = defineConfig({
  key: OrganizationConfigKey.Tagline,
  schema: plainText("Tagline", 100),
  default: "",
  visibility: "public",
});

export const logoUrl = defineConfig({
  key: OrganizationConfigKey.LogoUrl,
  schema: z.string().min(1, "Logo URL must be a non-empty string").nullable(),
  // No logo: callers fall back to their own default logo.
  default: null,
  visibility: "public",
  label: "logo URL",
});

export const primaryColor = defineConfig({
  key: OrganizationConfigKey.PrimaryColor,
  schema: hexColor,
  default: DEFAULT_BRANDING[OrganizationConfigKey.PrimaryColor],
  visibility: "public",
});

export const secondaryColor = defineConfig({
  key: OrganizationConfigKey.SecondaryColor,
  schema: hexColor,
  default: DEFAULT_BRANDING[OrganizationConfigKey.SecondaryColor],
  visibility: "public",
});

// The theme's other keys are rendered on the server (app/layout.tsx), so no
// client reads them.

export const description = defineConfig({
  key: OrganizationConfigKey.Description,
  schema: plainText("Description", 300),
  default: "No description has been set",
  visibility: "admin",
});

export const backgroundColor = defineConfig({
  key: OrganizationConfigKey.BackgroundColor,
  schema: hexColor,
  default: DEFAULT_APP_THEME.backgroundColor,
  visibility: "admin",
});

export const textColor = defineConfig({
  key: OrganizationConfigKey.TextColor,
  schema: hexColor,
  default: DEFAULT_APP_THEME.textColor,
  visibility: "admin",
});

export const displayFont = defineConfig({
  key: OrganizationConfigKey.DisplayFont,
  schema: themeFont,
  default: DEFAULT_APP_THEME.displayFont,
  visibility: "admin",
});

export const headingFont = defineConfig({
  key: OrganizationConfigKey.HeadingFont,
  schema: themeFont,
  default: DEFAULT_APP_THEME.headingFont,
  visibility: "admin",
});

export const bodyFont = defineConfig({
  key: OrganizationConfigKey.BodyFont,
  schema: themeFont,
  default: DEFAULT_APP_THEME.bodyFont,
  visibility: "admin",
});

export const cornerStyle = defineConfig({
  key: OrganizationConfigKey.CornerStyle,
  schema: z.enum(CORNER_STYLE_VALUES, {
    error: `Corner style must be one of: ${CORNER_STYLE_VALUES.join(", ")}`,
  }),
  default: DEFAULT_APP_THEME.cornerStyle,
  visibility: "admin",
});

export const CORE_CONFIG = configGroup(
  tagline,
  logoUrl,
  primaryColor,
  secondaryColor,
  description,
  backgroundColor,
  textColor,
  displayFont,
  headingFont,
  bodyFont,
  cornerStyle,
);
