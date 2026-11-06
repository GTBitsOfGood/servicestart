// The navigation context's public API: other contexts import from
// "@/features/navigation", never from a file inside it.

export { default as OrganizationLogo } from "./components/OrganizationLogo";
export { OrganizationFooterSchema, SOCIAL_PLATFORMS } from "./footer";
export type { OrganizationFooter, SocialPlatform } from "./footer";
