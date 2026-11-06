import { z } from "zod";
import { NAVBAR_HREFS } from "@/features/navigation/navItems";

const NavbarHrefSchema = z
  .string()
  .refine((href) => NAVBAR_HREFS.has(href), "Not a navbar item");

const NavbarAudienceConfigSchema = z.strictObject({
  /** Navbar items, by href, this audience doesn't see. */
  hidden: z.array(NavbarHrefSchema).optional(),
  /** New labels for navbar items, by href. */
  labels: z
    .record(NavbarHrefSchema, z.string().trim().min(1).max(40))
    .optional(),
});
export type NavbarAudienceConfig = z.infer<typeof NavbarAudienceConfigSchema>;

/**
 * How the navbar differs per audience (#318). Admins always get the full
 * admin navbar. Hiding an item only hides it; it doesn't restrict the page.
 */
export const NavbarConfigSchema = z.strictObject({
  member: NavbarAudienceConfigSchema.optional(),
  applicant: NavbarAudienceConfigSchema.optional(),
  attendee: NavbarAudienceConfigSchema.optional(),
});
export type NavbarConfig = z.infer<typeof NavbarConfigSchema>;

export const DEFAULT_NAVBAR_CONFIG: NavbarConfig = {};
