"use client";

import type { ReactNode } from "react";
import BogBanner, {
  type BannerType,
} from "@/components/bog/BogBanner/BogBanner";

export type FormMessage =
  | { kind: "loading"; text: string }
  | { kind: "error"; text: ReactNode }
  | { kind: "success"; text: string };

const BANNER_TYPE = {
  loading: "message",
  error: "error",
  success: "success",
} as const satisfies Record<FormMessage["kind"], BannerType>;

/**
 * The form-level status under an auth form ("Loading…", "Uh-oh, account
 * already exists", "Yay, account created!"). The wrapper is a live region
 * that's always rendered, so screen readers announce each new message once;
 * the banner's own alert role is turned off so errors aren't read twice.
 */
export default function AuthFormMessage({
  message,
}: {
  message: FormMessage | undefined;
}) {
  return (
    <div role="status" data-testid="form-message">
      {message && (
        <BogBanner
          type={BANNER_TYPE[message.kind]}
          role="presentation"
          variant="surface"
          content={<span>{message.text}</span>}
        />
      )}
    </div>
  );
}
