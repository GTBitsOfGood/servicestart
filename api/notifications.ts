import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import db from "@/lib/db";
import { notifications } from "@/lib/schema";
import { paginationQuerySchema } from "../lib/apiUtils";
import { requireMembership } from "@/lib/authUtils";

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
    const data = await db
      .select({
        id: notifications.id,
        userId: notifications.userId,
        organizationId: notifications.organizationId,
        createdAt: notifications.createdAt,
        read: notifications.read,
        text: notifications.text,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, session.user.id),
          eq(notifications.organizationId, activeOrganizationId),
          eq(notifications.read, read),
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

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
    const [notification] = await db
      .select({
        id: notifications.id,
        userId: notifications.userId,
      })
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);

    // if notification not found, return not found
    if (!notification) {
      return c.json({ error: "Notification not found" }, { status: 404 });
    }

    // if notification does not belong to the user, return forbidden
    if (notification.userId !== session.user.id) {
      return c.json({ error: "Forbidden" }, { status: 403 });
    }

    const [updated] = await db
      .update(notifications)
      .set({ read })
      .where(eq(notifications.id, id))
      .returning({
        id: notifications.id,
        userId: notifications.userId,
        organizationId: notifications.organizationId,
        createdAt: notifications.createdAt,
        read: notifications.read,
        text: notifications.text,
      });

    return c.json(updated);
  });

export default app;
