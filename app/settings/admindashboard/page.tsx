import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { MembersService } from "@/lib/services/MemberService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { getWidgetOptions } from "@/lib/dashboard/widgets";
import DashboardLayoutBuilder from "@/components/dashboard/DashboardLayoutBuilder";
import type { DashboardLayout } from "@/lib/dashboard/schema";
import {
  ForbiddenError,
  NoActiveOrganizationError,
  UnauthorizedError,
} from "@/lib/errors";
import { redirectIfNotAdmin } from "@/lib/authUtils";

export const metadata = {
  title: "Customize Admin Dashboard",
};

export default async function AdminDashboardSettingsPage() {
  const session = await redirectIfNotAdmin();
  const organizationId = session.session.activeOrganizationId;

  const layout =
    await OrganizationConfigService.getAdminDashboardLayout(organizationId);
  const widgetOptions = getWidgetOptions();

  async function saveLayout(newLayout: DashboardLayout) {
    "use server";
    const sess = await auth.api.getSession({
      headers: await headers(),
    });
    if (!sess?.user) throw new UnauthorizedError();

    const orgId = sess.session.activeOrganizationId;
    if (!orgId) throw new NoActiveOrganizationError();

    const membership = await MembersService.findByUserAndOrganization(
      sess.user.id,
      orgId,
    );
    if (!MembersService.isAdminOrOwner(membership?.role))
      throw new ForbiddenError();

    await OrganizationConfigService.setAdminDashboardLayout(
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
