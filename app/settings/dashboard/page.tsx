import Link from "next/link";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import { FormService } from "@/features/forms/services/FormService";
import {
  getWidgetOptions,
  WIDGET_FEATURE_KEYS,
} from "@/features/dashboard/widgets";
import type { MemberAudience } from "@/features/membership/lib/audience";
import { getMemberTypeDashboardLayout } from "@/features/dashboard/config";
import DashboardLayoutBuilder from "@/features/dashboard/components/DashboardLayoutBuilder";
import type { DashboardLayout } from "@/features/dashboard/lib/schema";
import { FormStatus } from "@/features/forms/schema";
import { MemberTypeKeySchema } from "@/features/membership/lib/memberTypeKey";
import { OrganizationConfigKey } from "@/core/config/schema";
import { MemberTypeService } from "@/features/membership/server";
import { redirectIfNotAdmin } from "@/core/auth/authUtils";
import { cn } from "@/core/utils/utils";
import { clearDashboardLayout, saveDashboardLayout } from "./actions";

export const metadata = {
  title: "Customize Dashboards",
};

type DashboardSettingsPageProps = {
  searchParams: Promise<{ audience?: string | string[] }>;
};

const resolveAudience = (
  requested: string | string[] | undefined,
  memberTypesEnabled: boolean,
  typeKeys: Set<string>,
): MemberAudience => {
  const raw = Array.isArray(requested) ? requested[0] : requested;
  if (!memberTypesEnabled || raw === "member" || raw == null) {
    return "member";
  }
  const parsed = MemberTypeKeySchema.safeParse(raw);
  if (parsed.success && typeKeys.has(parsed.data)) {
    return parsed.data;
  }
  return "member";
};

export default async function DashboardSettingsPage({
  searchParams,
}: DashboardSettingsPageProps) {
  const { organizationId } = await redirectIfNotAdmin();

  const [memberTypesEnabled, features, forms, { audience: requested }] =
    await Promise.all([
      OrganizationConfigService.getMemberTypesEnabled(organizationId),
      OrganizationConfigService.getConfig(organizationId, WIDGET_FEATURE_KEYS),
      OrganizationConfigService.getConfig(organizationId, [
        OrganizationConfigKey.FormsEnabled,
      ]).then((config) =>
        config[OrganizationConfigKey.FormsEnabled]
          ? FormService.list(organizationId)
          : [],
      ),
      searchParams,
    ]);
  const memberTypes = memberTypesEnabled
    ? await MemberTypeService.list(organizationId)
    : [];
  const typeKeys = new Set(memberTypes.map((row) => row.key));
  const audience = resolveAudience(requested, memberTypesEnabled, typeKeys);

  const ownLayout: DashboardLayout | null =
    audience === "member"
      ? null
      : await getMemberTypeDashboardLayout(organizationId, audience);
  const layout =
    ownLayout ??
    (await OrganizationConfigService.getDashboardLayout(organizationId));

  const audienceOptions: { value: MemberAudience; label: string }[] =
    memberTypesEnabled
      ? [
          { value: "member", label: "Members" },
          ...memberTypes.map((row) => ({
            value: row.key,
            label: row.pluralLabel,
          })),
        ]
      : [];

  return (
    <DashboardLayoutBuilder
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
          {audienceOptions.map((option) => (
            <Link
              key={option.value}
              href={`?audience=${option.value}`}
              aria-current={option.value === audience ? "page" : undefined}
              className={cn(
                "theme-control rounded px-3 py-2 text-paragraph-2 font-semibold",
                option.value === audience
                  ? "bg-brand-text text-brand-foreground"
                  : "text-brand-text hover:bg-brand-fill",
              )}
            >
              {option.label}
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
              Deletes the{" "}
              {audienceOptions.find((o) => o.value === audience)?.label ??
                "type"}{" "}
              layout, so they see the member layout.
            </p>
          </form>
        ) : (
          <p className="mt-4 text-paragraph-2 text-grey-text-weak">
            Using the member layout. Saving creates a separate{" "}
            {audienceOptions.find((o) => o.value === audience)?.label ?? "type"}{" "}
            layout.
          </p>
        ))}
    </DashboardLayoutBuilder>
  );
}
