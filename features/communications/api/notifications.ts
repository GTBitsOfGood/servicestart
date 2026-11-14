import { ForbiddenError, NotFoundError } from "@/core/api/errors";
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { paginationQuerySchema } from "@/core/api/apiUtils";
import { requireMembership, requireAdmin } from "@/core/auth/authUtils";

import { NotificationService } from "@/features/communications/services/NotificationService";
import { NotificationType } from "@/features/communications/schema";
import { JoinRequestsService } from "@/features/membership/server";
import { JoinRequestStatus } from "@/features/membership";

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
      throw new NotFoundError("Notification not found");
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
      throw new NotFoundError("Notification not found");
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
      throw new NotFoundError("Notification not found");
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
    const session = await requireAdmin(c);
    //admin check
    const activeOrganizationId = session.session.activeOrganizationId!;
    const { id: notificationId } = c.req.param();

    const notification = await NotificationService.findById(notificationId);
    if (!notification) throw new NotFoundError("Notification not found");

    if (
      notification.userId !== session.user.id ||
      notification.organizationId !== activeOrganizationId
    ) {
      throw new ForbiddenError();
    }

    const metadata = notification.metadata as { joinRequestId?: string } | null;
    const joinRequestId = metadata?.joinRequestId;
    if (!joinRequestId) throw new NotFoundError("Join request not found");

    const joinRequest = await JoinRequestsService.findByIdAndOrganization(
      joinRequestId,
      activeOrganizationId,
    );
    if (!joinRequest) throw new NotFoundError("Join request not found");

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
    const session = await requireAdmin(c);
    //admin check
    const activeOrganizationId = session.session.activeOrganizationId!;
    const { id: notificationId } = c.req.param();

    const notification = await NotificationService.findById(notificationId);
    if (!notification) throw new NotFoundError("Notification not found");

    if (
      notification.userId !== session.user.id ||
      notification.organizationId !== activeOrganizationId
    ) {
      throw new ForbiddenError();
    }

    const metadata = notification.metadata as { joinRequestId?: string } | null;
    const joinRequestId = metadata?.joinRequestId;
    if (!joinRequestId) throw new NotFoundError("Join request not found");

    const joinRequest = await JoinRequestsService.findByIdAndOrganization(
      joinRequestId,
      activeOrganizationId,
    );
    if (!joinRequest) throw new NotFoundError("Join request not found");

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
