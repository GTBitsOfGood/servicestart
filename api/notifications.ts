import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { paginationQuerySchema } from "../lib/apiUtils";
import { requireMembership } from "@/lib/authUtils";
import { ForbiddenError } from "@/lib/errors";
import { NotificationService } from "@/lib/services/NotificationService";
import { NOTIFICATION_TYPE_VALUES, NotificationType } from "@/lib/schema";

const notificationsQuerySchema = paginationQuerySchema.and(
  z.object({
    read: z
      .preprocess(
        (val) => (val === "" || val === null ? undefined : val),
        z.enum(["true", "false"]).optional(),
      )
      .transform((val) => val === "true"),
    type: z.preprocess(
      (val) => (val === "" || val === null ? undefined : val),
      z.enum(NOTIFICATION_TYPE_VALUES).optional(),
    ),
  }),
);

const updateReadStatusSchema = z.object({
  read: z.boolean(),
});

const app = new Hono()
  .get("/", zValidator("query", notificationsQuerySchema), async (c) => {
    const session = await requireMembership(c);

    const activeOrganizationId = session.session.activeOrganizationId!;

    const { page, pageSize, read, type } = c.req.valid("query");
    const data = await NotificationService.listByUserAndOrganization(
      session.user.id,
      activeOrganizationId,
      read,
      type as NotificationType | undefined,
      { limit: pageSize, offset: (page - 1) * pageSize },
    );

    return c.json({
      data,
      page,
      pageSize,
    });
  })
  .patch("/:id", zValidator("json", updateReadStatusSchema), async (c) => {
    // pulling session info and verifying user is a member of active organization
    const session = await requireMembership(c);

    // getting notification id from request params
    const { id } = c.req.param();
    const { read } = c.req.valid("json");

    // checking if notification exists
    const notification = await NotificationService.findById(id);

    // if notification not found, return not found
    if (!notification) {
      return c.notFound();
    }

    // if notification does not belong to the user, return forbidden
    if (notification.userId !== session.user.id) {
      throw new ForbiddenError();
    }

    const updated = await NotificationService.updateReadStatus(id, read);

    return c.json(updated);
  });

export default app;
