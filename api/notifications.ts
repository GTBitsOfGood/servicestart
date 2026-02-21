import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { paginationQuerySchema } from "../lib/apiUtils";
import { requireMembership } from "@/lib/authUtils";
import { NotificationService } from "@/lib/services/NotificationService";

const notificationsQuerySchema = paginationQuerySchema.and(
  z.object({
    read: z
      .preprocess(
        (val) => (val === "" || val === null ? undefined : val),
        z.enum(["true", "false"]).optional(),
      )
      .transform((val) => val === "true"),
  }),
);

const updateReadStatusSchema = z.object({
  read: z.boolean(),
});

const app = new Hono()
  .get("/", zValidator("query", notificationsQuerySchema), async (c) => {
    const session = await requireMembership(c);

    const activeOrganizationId = session.session.activeOrganizationId!;

    const { page, pageSize, read } = c.req.valid("query");
    const data = await NotificationService.listByUserAndOrganization(
      session.user.id,
      activeOrganizationId,
      read,
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
      return c.json({ error: "Notification not found" }, { status: 404 });
    }

    // if notification does not belong to the user, return forbidden
    if (notification.userId !== session.user.id) {
      return c.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await NotificationService.updateReadStatus(id, read);

    return c.json(updated);
  });

export default app;
