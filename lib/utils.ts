import clsx, { type ClassValue } from "clsx";

const ROOT_DOMAIN =
  typeof process !== "undefined" && process.env.E2E_TENANT_DOMAIN
    ? process.env.E2E_TENANT_DOMAIN
    : "lvh.me";
export const DEFAULT_SLUG = "servicestart";

export function cn(...inputs: ClassValue[]) {
  return clsx(...inputs);
}

export function formatTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} mins ago`;
  if (diffHours < 24) return `${diffHours} hrs ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getSlugFromHostname(hostname: string): string {
  if (hostname === ROOT_DOMAIN) return DEFAULT_SLUG;
  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const subdomain = hostname.slice(0, -ROOT_DOMAIN.length - 1);
    return subdomain || DEFAULT_SLUG;
  }
  return DEFAULT_SLUG;
}

// Any origin works; it only tells local paths from external URLs.
const REDIRECT_BASE = "http://redirect.invalid";

/**
 * The `redirect` search param as a path on this site, otherwise "/". Parses
 * it the way the browser will, since parsing drops characters like tabs, so
 * "/\t/evil.com" becomes "//evil.com" and is rejected.
 */
export function getRedirectPath(search: string) {
  const path = new URLSearchParams(search).get("redirect");
  if (!path?.startsWith("/")) return "/";
  const url = new URL(path, REDIRECT_BASE);
  return url.origin === REDIRECT_BASE
    ? `${url.pathname}${url.search}${url.hash}`
    : "/";
}
