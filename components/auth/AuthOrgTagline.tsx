"use client";

import useOrganizationConfig from "@/lib/hooks/useOrganizationConfig";
import { OrganizationConfigKey } from "@/lib/schema";

const DEFAULT_TAGLINE = "Welcome";

/** Org-configured tagline for login and signup. */
export default function AuthOrgTagline() {
  const config = useOrganizationConfig([OrganizationConfigKey.Tagline]);
  const tagline = config.tagline?.trim() || DEFAULT_TAGLINE;

  return (
    <p className="text-grey-text-strong" data-testid="organization-tagline">
      {tagline}
    </p>
  );
}
