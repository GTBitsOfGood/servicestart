import { z } from "zod";

/*
 * An org's footer (#320): how to reach it and where to follow it. An org
 * with nothing set has no footer.
 */

export const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "x",
  "youtube",
  "tiktok",
  "website",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SocialLinkSchema = z.strictObject({
  platform: z.enum(SOCIAL_PLATFORMS),
  url: z.url({ protocol: /^https?$/, error: "Enter a web address" }),
});

export const OrganizationFooterSchema = z.strictObject({
  email: z.email("Enter a valid email address").optional(),
  phone: z.string().trim().min(1).max(30).optional(),
  /** A US Employer Identification Number, e.g. 12-3456789. */
  ein: z
    .string()
    .regex(/^\d{2}-\d{7}$/, "Enter an EIN like 12-3456789")
    .optional(),
  address: z.string().trim().min(1).max(200).optional(),
  socialLinks: z.array(SocialLinkSchema).max(10).optional(),
});
export type OrganizationFooter = z.infer<typeof OrganizationFooterSchema>;

export const DEFAULT_ORGANIZATION_FOOTER: OrganizationFooter = {};
