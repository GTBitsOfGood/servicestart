import { OrganizationConfigKey } from "@/core/config/schema";

/*
 * One sample per config key, for the per-key tests in registry.test.ts and
 * store.test.ts. Typed as a Record over every key, so adding a key without a
 * sample fails the typecheck.
 *
 * - valid: a typed value the key accepts.
 * - stored: the text that value is stored as (today's format, unchanged).
 * - invalid: a value the key rejects, and part of the message it gets.
 */
export type ConfigSample = {
  valid: unknown;
  stored: string;
  invalid: unknown;
  message: string | RegExp;
};

const layout = {
  layout: "horizontal",
  widgets: [{ id: "events", size: "tall" }],
};
const badLayout = { layout: "horizontal", widgets: [{ id: "nope" }] };

const hex = (valid: string): ConfigSample => ({
  valid,
  stored: valid,
  invalid: "cream",
  message: "Color must be a valid hex code",
});

const toggle = (valid: boolean): ConfigSample => ({
  valid,
  stored: String(valid),
  invalid: "yes",
  message: "Value must be 'true' or 'false'",
});

const font = (valid: string): ConfigSample => ({
  valid,
  stored: valid,
  invalid: "comic-sans",
  message: "Font must be one of",
});

const json = (
  valid: unknown,
  invalid: unknown,
  message: string | RegExp,
): ConfigSample => ({
  valid,
  stored: JSON.stringify(valid),
  invalid,
  message,
});

export const CONFIG_SAMPLES: Record<OrganizationConfigKey, ConfigSample> = {
  [OrganizationConfigKey.Description]: {
    valid: "We plant trees.",
    stored: "We plant trees.",
    invalid: "<b>bad</b>",
    message: "Description must not contain HTML tags",
  },
  [OrganizationConfigKey.Tagline]: {
    valid: "Grow with us",
    stored: "Grow with us",
    invalid: "x".repeat(101),
    message: "Tagline must be no longer than 100 characters",
  },
  [OrganizationConfigKey.LogoUrl]: {
    valid: "/bog.svg",
    stored: "/bog.svg",
    invalid: "",
    message: "Logo URL must be a non-empty string",
  },
  [OrganizationConfigKey.PrimaryColor]: hex("#7D52A1"),
  [OrganizationConfigKey.SecondaryColor]: hex("#C29BDC"),
  [OrganizationConfigKey.BackgroundColor]: hex("#FFFEF1"),
  [OrganizationConfigKey.TextColor]: hex("#111111"),
  [OrganizationConfigKey.DisplayFont]: font("open-sans"),
  [OrganizationConfigKey.HeadingFont]: font("open-sans"),
  [OrganizationConfigKey.BodyFont]: font("visby"),
  [OrganizationConfigKey.CornerStyle]: {
    valid: "pill",
    stored: "pill",
    invalid: "extra-round",
    message: "Corner style must be one of",
  },
  [OrganizationConfigKey.FormsEnabled]: toggle(true),
  [OrganizationConfigKey.MembersPageEnabled]: toggle(false),
  [OrganizationConfigKey.MemberTypesEnabled]: toggle(true),
  [OrganizationConfigKey.AutoApproveSignups]: toggle(true),
  [OrganizationConfigKey.NavbarVariant]: {
    valid: "horizontal-center",
    stored: "horizontal-center",
    invalid: "diagonal",
    message: "Invalid navbar variant: diagonal",
  },
  [OrganizationConfigKey.MobileNavbarVariant]: {
    valid: "mobile-right-sidebar-pinned",
    stored: "mobile-right-sidebar-pinned",
    invalid: "mobile-top",
    message: "Invalid mobile navbar variant: mobile-top",
  },
  [OrganizationConfigKey.MobileNavbarShowIcons]: {
    valid: false,
    stored: "false",
    invalid: "sometimes",
    message: "Value must be 'true', 'false', or 'inherit'",
  },
  [OrganizationConfigKey.MobileNavbarProfileOrientation]: {
    valid: "vertical",
    stored: "vertical",
    invalid: "diagonal",
    message:
      "Profile orientation must be 'vertical', 'horizontal', or 'inherit'",
  },
  [OrganizationConfigKey.NavbarColor]: {
    valid: "white",
    stored: "white",
    invalid: "blue",
    message: "Navbar color must be either 'red' or 'white'",
  },
  [OrganizationConfigKey.NavbarConfig]: json(
    { applicant: { hidden: ["/events"] } },
    { applicant: { hidden: ["/nowhere"] } },
    /^Invalid navbar config \(applicant\.hidden\.0\)/,
  ),
  [OrganizationConfigKey.OrganizationFooter]: json(
    { email: "hello@example.com", ein: "84-4516921" },
    { socialLinks: [{ platform: "x", url: "nope" }] },
    "Invalid footer (socialLinks.0.url): Enter a web address",
  ),
  [OrganizationConfigKey.AdminDashboardLayout]: json(
    layout,
    badLayout,
    /^Invalid admin dashboard layout \(widgets\.0/,
  ),
  [OrganizationConfigKey.DashboardLayout]: json(
    layout,
    badLayout,
    /^Invalid dashboard layout \(widgets\.0/,
  ),
  [OrganizationConfigKey.ApplicantDashboardLayout]: json(
    layout,
    badLayout,
    /^Invalid applicant dashboard layout \(widgets\.0/,
  ),
  [OrganizationConfigKey.AttendeeDashboardLayout]: json(
    layout,
    badLayout,
    /^Invalid attendee dashboard layout \(widgets\.0/,
  ),
  [OrganizationConfigKey.MemberTypeDashboardLayouts]: json(
    { applicant: layout },
    { applicant: badLayout },
    /^Invalid member type dashboard layouts \(applicant\.widgets\.0/,
  ),
  [OrganizationConfigKey.DashboardHeader]: json(
    { attendee: { title: "My Camp Dashboard" } },
    { default: { banner: "x" } },
    /^Invalid dashboard header/,
  ),
};
