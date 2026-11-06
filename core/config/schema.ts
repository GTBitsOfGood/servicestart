import { pgTable, index, text } from "drizzle-orm/pg-core";
import { organizations } from "@/core/tenant/schema";

// Per-organization settings, one row per key.

// Every key an organization can set. organization_config.key is plain text, so
// adding a key needs no migration; the API's Zod check restricts keys to these.
export enum OrganizationConfigKey {
  Description = "description",
  PrimaryColor = "primary_color",
  SecondaryColor = "secondary_color",
  Tagline = "tagline",
  NavbarVariant = "navbar_variant",
  NavbarColor = "navbar_color",
  MembersPageEnabled = "members_page_enabled",
  LogoUrl = "logo_url",
  AdminDashboardLayout = "admin_dashboard_layout",
  DashboardLayout = "dashboard_layout",
  MobileNavbarVariant = "mobile_navbar_variant",
  MobileNavbarShowIcons = "mobile_navbar_show_icons",
  MobileNavbarProfileOrientation = "mobile_navbar_profile_orientation",
  FormsEnabled = "forms_enabled",
  MemberTypesEnabled = "member_types_enabled",
  AutoApproveSignups = "auto_approve_signups",
  BackgroundColor = "background_color",
  TextColor = "text_color",
  DisplayFont = "display_font",
  HeadingFont = "heading_font",
  BodyFont = "body_font",
  CornerStyle = "corner_style",
  ApplicantDashboardLayout = "applicant_dashboard_layout",
  AttendeeDashboardLayout = "attendee_dashboard_layout",
  DashboardHeader = "dashboard_header",
  NavbarConfig = "navbar_config",
  OrganizationFooter = "organization_footer",
  // Each member type's own dashboard layout, by member type key. Replaces
  // ApplicantDashboardLayout and AttendeeDashboardLayout, which #336 removes.
  MemberTypeDashboardLayouts = "member_type_dashboard_layouts",
}

export type ToggleableOrganizationFeature = Extract<
  OrganizationConfigKey,
  | OrganizationConfigKey.MembersPageEnabled
  | OrganizationConfigKey.FormsEnabled
  | OrganizationConfigKey.MemberTypesEnabled
  | OrganizationConfigKey.AutoApproveSignups
>;

// Array of enum values for use with Zod
export const ORGANIZATION_CONFIG_KEY_VALUES = Object.values(
  OrganizationConfigKey,
) as unknown as readonly [string, ...string[]];

export const organizationConfig = pgTable(
  "organization_config",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: text("key").$type<OrganizationConfigKey>().notNull(),
    value: text("value").notNull(),
  },
  (table) => [
    index("organization_config_organizationId_key_idx").on(
      table.organizationId,
      table.key,
    ),
  ],
);
