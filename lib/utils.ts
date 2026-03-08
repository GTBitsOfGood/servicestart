import clsx, { type ClassValue } from "clsx";

const ROOT_DOMAIN = "servicestart.com";
export const DEFAULT_SLUG = "servicestart";

export function cn(...inputs: ClassValue[]) {
  return clsx(...inputs);
}

export function getSlugFromHostname(hostname: string): string {
  if (hostname === ROOT_DOMAIN) return DEFAULT_SLUG;
  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const subdomain = hostname.slice(0, -ROOT_DOMAIN.length - 1);
    return subdomain || DEFAULT_SLUG;
  }
  return DEFAULT_SLUG;
}
