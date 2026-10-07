/** Keyboard focus outline shared by the auth pages' buttons and links. */
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-text";

/** Inline text link, e.g. "Forgot password?" or "Log in". */
export const AUTH_LINK_CLASS = `rounded-control font-bold text-page-text underline ${FOCUS_RING}`;
