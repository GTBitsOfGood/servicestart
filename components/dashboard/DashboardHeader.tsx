import type { DashboardAudience } from "@/lib/dashboard/audience";

export type DashboardHeaderProps = {
  organizationId: string;
  audience: DashboardAudience;
  user: { id: string; name: string };
};

// Placeholder until #320 makes the header configurable (DashboardHeader
// config) and adds the alert banner. Until then it's the built-in heading.
export default async function DashboardHeader({
  audience,
}: DashboardHeaderProps) {
  return (
    <h1 className="mb-8 font-normal text-heading-1 text-page-text">
      {audience === "admin" ? "Admin Dashboard" : "Dashboard"}
    </h1>
  );
}
