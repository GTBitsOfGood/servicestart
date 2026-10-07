"use client";

import type { ReactNode } from "react";
import OrganizationNotFound from "@/components/OrganizationNotFound";
import UnauthenticatedOrganizationLogo from "@/components/UnauthenticatedOrganizationLogo";
import { resolveBranding } from "@/lib/branding";
import useOrganizationConfig from "@/lib/hooks/useOrganizationConfig";
import { OrganizationConfigKey } from "@/lib/schema";

const AUTH_CONFIG_KEYS = [
  OrganizationConfigKey.PrimaryColor,
  OrganizationConfigKey.SecondaryColor,
  OrganizationConfigKey.Tagline,
  OrganizationConfigKey.LogoUrl,
] as const;

const DEFAULT_TAGLINE = "Welcome";

type AuthLayoutProps = {
  title: ReactNode;
  /** Text under the title. */
  description?: ReactNode;
  /** Show the org's configured tagline under the title instead. */
  showTagline?: boolean;
  children: ReactNode;
};

/**
 * Shared shell for the signed-out pages: the org's brand panel with its logo,
 * and a card for the form. One column on mobile, two from `desktop` up.
 */
export default function AuthLayout({
  title,
  description,
  showTagline = false,
  children,
}: AuthLayoutProps) {
  const config = useOrganizationConfig(AUTH_CONFIG_KEYS);
  const { primary_color: primary, secondary_color: secondary } =
    resolveBranding(config);

  if (config.status === "not-found") return <OrganizationNotFound />;

  const tagline = config.tagline?.trim() || DEFAULT_TAGLINE;

  return (
    <div
      className="flex min-h-dvh w-full flex-col gap-4 p-4 desktop:flex-row desktop:gap-8 desktop:p-8"
      data-testid="page"
      style={{
        backgroundImage: `linear-gradient(75deg, ${primary} 0%, ${secondary} 100%)`,
      }}
    >
      <div
        className="relative h-48 shrink-0 rounded-3xl desktop:h-auto desktop:w-1/2"
        style={{
          backgroundImage: `linear-gradient(180deg, ${primary} 0%, var(--color-page-bg) 100%)`,
        }}
      >
        <UnauthenticatedOrganizationLogo logoUrl={config.logo_url} />
      </div>
      <main className="flex flex-1 items-center justify-center">
        <div className="flex w-full max-w-200 flex-col gap-8 rounded-3xl bg-page-bg p-8 text-page-text shadow-lg desktop:p-14">
          {/* Its own page-bg so the tagline's contrast is checked against it. */}
          <div className="flex flex-col gap-3 bg-page-bg">
            <h1 className="font-display">{title}</h1>
            {showTagline ? (
              <p
                className="text-grey-text-strong"
                data-testid="organization-tagline"
              >
                {tagline}
              </p>
            ) : (
              description && (
                <p className="text-grey-text-weak">{description}</p>
              )
            )}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
