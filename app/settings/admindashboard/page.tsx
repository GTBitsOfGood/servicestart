import { headers } from "next/headers";
import { auth } from "@/core/auth/auth";
import { MembersService } from "@/features/membership/services/MemberService";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import {
  getWidgetOptions,
  WIDGET_FEATURE_KEYS,
} from "@/features/dashboard/widgets";
import DashboardLayoutBuilder from "@/features/dashboard/components/DashboardLayoutBuilder";
import type { DashboardLayout } from "@/features/dashboard/lib/schema";
import {
  ForbiddenError,
  NoActiveOrganizationError,
  UnauthorizedError,
} from "@/core/api/errors";
import { redirectIfNotAdmin } from "@/core/auth/authUtils";

export const metadata = {
  title: "Customize Admin Dashboard",
};

export default async function AdminDashboardSettingsPage() {
  const { organizationId } = await redirectIfNotAdmin();

  const layout =
    await OrganizationConfigService.getAdminDashboardLayout(organizationId);
  const widgetOptions = getWidgetOptions(
    await OrganizationConfigService.getConfig(
      organizationId,
      WIDGET_FEATURE_KEYS,
    ),
  );

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
