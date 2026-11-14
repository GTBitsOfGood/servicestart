import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAdmin } from "@/core/auth/authUtils";
import { NotificationType } from "@/features/communications/schema";
import { PostDashboardAlertSchema } from "@/features/communications/lib/alerts";
import { NotificationService } from "@/features/communications/services/NotificationService";
import { MemberTypeService } from "@/features/membership/server";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";

const app = new Hono().post(
  "/",
  zValidator("json", PostDashboardAlertSchema),
  async (c) => {
    const session = await requireAdmin(c);
    const organizationId = session.session.activeOrganizationId!;
    const { title, message, memberTypes } = c.req.valid("json");

    const memberTypesEnabled =
      await OrganizationConfigService.getMemberTypesEnabled(organizationId);
    if (memberTypesEnabled && memberTypes?.length) {
      const unknown = await MemberTypeService.findUnknownKeys(
        organizationId,
        memberTypes,
      );
      if (unknown.length > 0) {
        return c.json({ error: "Unknown member type" }, 400);
      }
    }
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
