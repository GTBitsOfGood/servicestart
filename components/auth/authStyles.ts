/** Shared Tailwind classes for auth form text inputs (via BogTextInput). */
export const AUTH_FIELD_CLASS =
  "w-full font-semibold text-page-text [&_label]:text-mobile-paragraph-2 [&_label]:font-semibold [&_label]:text-page-text [&_input]:rounded-control [&_input]:border-grey-stroke-strong [&_input]:bg-page-bg [&_input]:px-4 [&_input]:py-3 [&_input]:text-mobile-paragraph-1 [&_input]:text-page-text";

/** Inline text link, e.g. "Forgot password?" or "Log in". */
export const AUTH_LINK_CLASS =
  "rounded-control font-bold text-page-text underline";

/** Full-width primary action styled as a link (invitation flows). */
export const AUTH_PRIMARY_LINK_CLASS =
  "flex w-full items-center justify-center rounded-control bg-brand-text px-5 py-3 text-mobile-paragraph-1 text-brand-foreground hover:bg-brand-hover";
