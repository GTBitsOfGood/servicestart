import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { MembersService } from "@/lib/services/MemberService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { getWidgetOptions } from "@/lib/dashboard/widgets";
import DashboardLayoutBuilder from "@/components/dashboard/DashboardLayoutBuilder";
import type { DashboardLayout } from "@/lib/dashboard/schema";

export const metadata = {
  title: "Customize Member Dashboard",
};

export default async function DashboardSettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) redirect("/login");

  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) redirect("/");

  const layout =
    await OrganizationConfigService.getDashboardLayout(organizationId);
  const widgetOptions = getWidgetOptions();

  async function saveLayout(newLayout: DashboardLayout) {
    "use server";
    const sess = await auth.api.getSession({
      headers: await headers(),
    });
    if (!sess?.user) throw new Error("Unauthorized");

    const orgId = sess.session.activeOrganizationId;
    if (!orgId) throw new Error("No active organization");

    const membership = await MembersService.findByUserAndOrganization(
      sess.user.id,
      orgId,
    );
    if (!MembersService.isAdminOrOwner(membership?.role))
      throw new Error("Forbidden");

    await OrganizationConfigService.setDashboardLayout(
      orgId,
      JSON.stringify(newLayout),
    );
  }

  return (
    <DashboardLayoutBuilder
      availableWidgets={widgetOptions}
      initialLayout={layout}
      onSave={saveLayout}
    />
  );
}
