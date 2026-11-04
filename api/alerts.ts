import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAdmin } from "@/lib/authUtils";
import { NotificationType } from "@/lib/schema";
import { PostDashboardAlertSchema } from "@/lib/dashboard/alerts";
import { NotificationService } from "@/lib/services/NotificationService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";

const app = new Hono().post(
  "/",
  zValidator("json", PostDashboardAlertSchema),
  async (c) => {
    const session = await requireAdmin(c);
    const organizationId = session.session.activeOrganizationId!;
    const { title, message, memberTypes } = c.req.valid("json");

    const memberTypesEnabled =
      await OrganizationConfigService.getMemberTypesEnabled(organizationId);
    const created = await NotificationService.notifyAllMembers(
      organizationId,
      `${title}\n${message}`,
      {
        type: NotificationType.Announcement,
        memberTypes: memberTypesEnabled ? memberTypes : undefined,
      },
    );

    return c.json({ sent: created.length }, 201);
  },
);

export default app;
