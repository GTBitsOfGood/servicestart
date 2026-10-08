import type { ReactNode } from "react";
import OrganizationLogo from "@/components/OrganizationLogo";

type FormPageLayoutProps = {
  organizationName: string;
  logoUrl?: string | null;
  children: ReactNode;
};

/** A brand panel with the org's logo beside the form, without the navbar. */
export default function FormPageLayout({
  organizationName,
  logoUrl,
  children,
}: FormPageLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-page-bg text-page-text desktop:flex-row">
      <aside className="flex items-center gap-4 bg-brand-text px-6 py-6 text-brand-foreground desktop:sticky desktop:top-0 desktop:h-screen desktop:w-2/5 desktop:flex-col desktop:items-start desktop:justify-between desktop:px-16 desktop:py-16">
        <OrganizationLogo
          logoUrl={logoUrl}
          alt={`${organizationName} logo`}
          className="size-16 desktop:size-32"
        />
        <p className="font-display text-heading-4 text-brand-foreground desktop:text-heading-2">
          {organizationName}
        </p>
      </aside>
      <main className="flex-1 px-6 py-10 desktop:px-16 desktop:py-16">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">{children}</div>
      </main>
    </div>
  );
}
