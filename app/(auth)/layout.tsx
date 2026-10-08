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
  OrganizationConfigKey.LogoUrl,
] as const;

const AUTH_FOCUS =
  "[&_:is(a,button,input):focus-visible]:outline-2 [&_:is(a,button,input):focus-visible]:outline-offset-2 [&_:is(a,button,input):focus-visible]:outline-brand-text";

/**
 * Shared shell for signed-out pages: brand panel, card, and org-not-found gate.
 * Each page supplies its own heading and intro copy.
 */
export default function AuthRouteLayout({ children }: { children: ReactNode }) {
  const config = useOrganizationConfig(AUTH_CONFIG_KEYS);
  const { primary_color: primary, secondary_color: secondary } =
    resolveBranding(config);

  if (config.status === "not-found") return <OrganizationNotFound />;

  return (
    <div
      className={`flex min-h-dvh w-full flex-col gap-4 p-4 desktop:flex-row desktop:gap-8 desktop:p-8 ${AUTH_FOCUS}`}
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
          {children}
        </div>
      </main>
    </div>
  );
}
