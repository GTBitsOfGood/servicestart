import type { DashboardAudience } from "@/lib/dashboard/audience";
import { CalendarDotsIcon, MapPinIcon } from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import DashboardAlertBanner from "@/components/dashboard/DashboardAlertBanner";
import {
  resolveDashboardHeader,
  type ResolvedDashboardHeader,
} from "@/lib/dashboard/header";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";

export type DashboardHeaderProps = {
  organizationId: string;
  audience: DashboardAudience;
  user: { id: string; name: string };
};

type ProgramDetailProps = {
  icon: Icon;
  label: string;
  value: string;
};

function ProgramDetail({ icon: DetailIcon, label, value }: ProgramDetailProps) {
  return (
    <div className="flex items-start gap-3">
      <DetailIcon
        aria-hidden="true"
        className="shrink-0 text-page-text/70"
        size={20}
        weight="fill"
      />
      <dt className="sr-only">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ProgramDetails({
  location,
  dates,
  schedule,
}: Pick<ResolvedDashboardHeader, "location" | "dates" | "schedule">) {
  if (!location && !dates && !schedule) return null;
  const datesAndSchedule = [dates, schedule].filter(Boolean).join(" | ");

  return (
    <dl className="mt-8 flex flex-col gap-3 text-[11px]! leading-6! font-paragraph! text-page-text/70">
      {location && (
        <ProgramDetail icon={MapPinIcon} label="Location" value={location} />
      )}
      {datesAndSchedule && (
        <ProgramDetail
          icon={CalendarDotsIcon}
          label="Dates and schedule"
          value={datesAndSchedule}
        />
      )}
    </dl>
  );
}

export default async function DashboardHeader({
  organizationId,
  audience,
  user,
}: DashboardHeaderProps) {
  const config =
    await OrganizationConfigService.getDashboardHeader(organizationId);
  const content = resolveDashboardHeader(config, audience, user.name);
  const hasDetails = Boolean(
    content.subtitle ||
    content.location ||
    content.dates ||
    content.schedule ||
    content.description,
  );

  return (
    <header
      className={
        hasDetails
          ? "mb-8 text-page-text desktop:mb-40"
          : "mb-4 text-page-text desktop:mb-8"
      }
    >
      <DashboardAlertBanner />
      <div className="max-w-348">
        <h1 className="text-heading-1 font-display! font-semibold">
          {content.title}
        </h1>
        {content.subtitle && (
          <p className="mt-8 text-heading-4 font-semibold text-page-text/70">
            {content.subtitle}
          </p>
        )}
        <ProgramDetails
          location={content.location}
          dates={content.dates}
          schedule={content.schedule}
        />
        {content.description && (
          <p className="mt-8 text-mobile-paragraph-2! leading-7! font-paragraph!">
            Camp Description: {content.description}
          </p>
        )}
      </div>
    </header>
  );
}
