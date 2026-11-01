import Link from "next/link";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { FormService } from "@/lib/services/FormService";
import { getWidgetOptions, WIDGET_FEATURE_KEYS } from "@/lib/dashboard/widgets";
import {
  MEMBER_AUDIENCES,
  type MemberAudience,
} from "@/lib/dashboard/audience";
import DashboardLayoutBuilder from "@/components/dashboard/DashboardLayoutBuilder";
import type { DashboardLayout } from "@/lib/dashboard/schema";
import { FormStatus, MemberType, OrganizationConfigKey } from "@/lib/schema";
import { MEMBER_TYPE_PLURAL_LABELS } from "@/lib/memberTypes";
import { redirectIfNotAdmin } from "@/lib/authUtils";
import { cn } from "@/lib/utils";
import { clearDashboardLayout, saveDashboardLayout } from "./actions";

export const metadata = {
  title: "Customize Member Dashboard",
};

const AUDIENCE_LABELS: Record<MemberAudience, string> = {
  member: "Members",
  applicant: MEMBER_TYPE_PLURAL_LABELS[MemberType.Applicant],
  attendee: MEMBER_TYPE_PLURAL_LABELS[MemberType.Attendee],
};

const LAYOUT_KEYS = {
  applicant: OrganizationConfigKey.ApplicantDashboardLayout,
  attendee: OrganizationConfigKey.AttendeeDashboardLayout,
} as const;

type DashboardSettingsPageProps = {
  searchParams: Promise<{ audience?: string | string[] }>;
};

export default async function DashboardSettingsPage({
  searchParams,
}: DashboardSettingsPageProps) {
  const { organizationId } = await redirectIfNotAdmin();

  const [memberTypesEnabled, features, forms, { audience: requested }] =
    await Promise.all([
      OrganizationConfigService.getMemberTypesEnabled(organizationId),
      OrganizationConfigService.getConfig(organizationId, WIDGET_FEATURE_KEYS),
      FormService.list(organizationId),
      searchParams,
    ]);
  const audience: MemberAudience =
    memberTypesEnabled && MEMBER_AUDIENCES.includes(requested as MemberAudience)
      ? (requested as MemberAudience)
      : "member";

  // Applicants and attendees without their own layout get the member one.
  const ownLayout: DashboardLayout | null =
    audience === "member"
      ? null
      : (
          await OrganizationConfigService.getConfig(organizationId, [
            LAYOUT_KEYS[audience],
          ])
        )[LAYOUT_KEYS[audience]];
  const layout =
    ownLayout ??
    (await OrganizationConfigService.getDashboardLayout(organizationId));

  return (
    <DashboardLayoutBuilder
      // Remount when the audience or its layout's source changes, e.g. after
      // "Use the member layout", so the builder starts from the new layout.
      key={`${audience}:${ownLayout ? "own" : "member"}`}
      availableWidgets={getWidgetOptions(features)}
      initialLayout={layout}
      onSave={saveDashboardLayout.bind(null, audience)}
      forms={forms
        .filter(({ status }) => status === FormStatus.Published)
        .map(({ formId, title }) => ({ formId, title }))}
    >
      {memberTypesEnabled && (
        <nav aria-label="Dashboard audience" className="mt-6 flex gap-2">
          {MEMBER_AUDIENCES.map((option) => (
            <Link
              key={option}
              href={`?audience=${option}`}
              aria-current={option === audience ? "page" : undefined}
              className={cn(
                "theme-control rounded px-3 py-2 text-paragraph-2 font-semibold",
                option === audience
                  ? "bg-brand-text text-brand-foreground"
                  : "text-brand-text hover:bg-brand-fill",
              )}
            >
              {AUDIENCE_LABELS[option]}
            </Link>
          ))}
        </nav>
      )}
      {audience !== "member" &&
        (ownLayout ? (
          <form
            action={clearDashboardLayout.bind(null, audience)}
            className="mt-4 flex flex-col items-start gap-1"
          >
            <button
              type="submit"
              className="theme-control rounded border border-brand-stroke-strong px-3 py-2 text-paragraph-2 font-semibold text-brand-text hover:bg-brand-fill"
            >
              Use the member layout
            </button>
            <p className="text-paragraph-2 text-grey-text-weak">
              Deletes the {AUDIENCE_LABELS[audience]} layout, so they see the
              member layout.
            </p>
          </form>
        ) : (
          <p className="mt-4 text-paragraph-2 text-grey-text-weak">
            Using the member layout. Saving creates a separate{" "}
            {AUDIENCE_LABELS[audience]} layout.
          </p>
        ))}
    </DashboardLayoutBuilder>
  );
}
