import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { paginationQuerySchema } from "../lib/apiUtils";
import { requireMembership } from "@/lib/authUtils";
import { ForbiddenError } from "@/lib/errors";
import { NotificationService } from "@/lib/services/NotificationService";
import { NotificationType } from "@/lib/schema";
import { JoinRequestsService } from "@/lib/services/JoinRequestService";
import { JoinRequestStatus } from "@/lib/schema";

const notificationsQuerySchema = paginationQuerySchema.and(
  z.object({
    read: z.enum(["all", "read", "unread"]).default("unread"),
    type: z.enum(NotificationType).optional(),
  }),
);

const updateReadStatusSchema = z.object({
  read: z.boolean(),
});

const app = new Hono()
  .get("/unreadCount", async (c) => {
    const session = await requireMembership(c);
    const activeOrganizationId = session.session.activeOrganizationId!;

    const count = await NotificationService.countByUserAndOrganization(
      session.user.id,
      activeOrganizationId,
      false,
      undefined,
    );

    return c.json({ count });
  })
  .get("/", zValidator("query", notificationsQuerySchema), async (c) => {
    const session = await requireMembership(c);

    const activeOrganizationId = session.session.activeOrganizationId!;

    const { page, pageSize, read, type } = c.req.valid("query");

    const data = await NotificationService.listByUserAndOrganization(
      session.user.id,
      activeOrganizationId,
      read,
      type,
      { limit: pageSize, offset: (page - 1) * pageSize },
    );

    return c.json({
      data,
      page,
      pageSize,
    });
  })
  .get("/:id", async (c) => {
    const session = await requireMembership(c);
    const activeOrganizationId = session.session.activeOrganizationId!;
    const { id } = c.req.param();

    const notification = await NotificationService.findById(id);

    if (!notification) {
      return c.json({ error: "Notification not found" }, 404);
    }

    if (
      notification.userId !== session.user.id ||
      notification.organizationId !== activeOrganizationId
    ) {
      throw new ForbiddenError();
    }

    return c.json(notification);
  })
  .post("/markAllRead", async (c) => {
    const session = await requireMembership(c);
    const activeOrganizationId = session.session.activeOrganizationId!;

    await NotificationService.markAllRead(
      session.user.id,
      activeOrganizationId,
    );

    return c.json({ success: true });
  })
  .patch("/:id", zValidator("json", updateReadStatusSchema), async (c) => {
    const session = await requireMembership(c);
    const activeOrganizationId = session.session.activeOrganizationId!;

    const { id } = c.req.param();
    const { read } = c.req.valid("json");

    const notification = await NotificationService.findById(id);

    if (!notification) {
      return c.json({ error: "Notification not found" }, 404);
    }

    if (
      notification.userId !== session.user.id ||
      notification.organizationId !== activeOrganizationId
    ) {
      throw new ForbiddenError();
    }

    const updated = await NotificationService.updateReadStatus(id, read);

    return c.json(updated);
  })
  .delete("/:id", async (c) => {
    const session = await requireMembership(c);
    const activeOrganizationId = session.session.activeOrganizationId!;
    const { id } = c.req.param();

    const notification = await NotificationService.findById(id);

    if (!notification) {
      return c.json({ error: "Notification not found" }, 404);
    }

    if (
      notification.userId !== session.user.id ||
      notification.organizationId !== activeOrganizationId
    ) {
      throw new ForbiddenError();
    }

    await NotificationService.deleteNotification(id);
    return c.json({ success: true });
  })
  .post("/:id/approve", async (c) => {
    const session = await requireMembership(c);
    const activeOrganizationId = session.session.activeOrganizationId!;
    const { id: notificationId } = c.req.param();

    const notification = await NotificationService.findById(notificationId);
    if (!notification) return c.json({ error: "Notification not found" }, 404);

    if (
      notification.userId !== session.user.id ||
      notification.organizationId !== activeOrganizationId
    ) {
      throw new ForbiddenError();
    }

    const joinRequest = await JoinRequestsService.findByUserAndOrganization(
      notification.userId,
      activeOrganizationId,
    );
    if (!joinRequest) return c.json({ error: "Join request not found" }, 404);

    await JoinRequestsService.updateStatus(
      joinRequest.id,
      JoinRequestStatus.Approved,
      session.user.id,
      c.req.raw.headers,
      undefined,
      joinRequest.status,
    );

    await NotificationService.updateReadStatus(notificationId, true);

    return c.json({ success: true });
  })
  .post("/:id/deny", async (c) => {
    const session = await requireMembership(c);
    const activeOrganizationId = session.session.activeOrganizationId!;
    const { id: notificationId } = c.req.param();

    const notification = await NotificationService.findById(notificationId);
    if (!notification) return c.json({ error: "Notification not found" }, 404);

    if (
      notification.userId !== session.user.id ||
      notification.organizationId !== activeOrganizationId
    ) {
      throw new ForbiddenError();
    }

    const joinRequest = await JoinRequestsService.findByUserAndOrganization(
      notification.userId,
      activeOrganizationId,
    );
    if (!joinRequest) return c.json({ error: "Join request not found" }, 404);

    await JoinRequestsService.updateStatus(
      joinRequest.id,
      JoinRequestStatus.Denied,
      session.user.id,
      c.req.raw.headers,
      undefined,
      joinRequest.status,
    );

    await NotificationService.updateReadStatus(notificationId, true);

    return c.json({ success: true });
  });

export default app;
