import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { notifications } from "@/lib/schema";
import { paginationQuerySchema } from "../lib/apiUtils";

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

const app = new Hono().get(
  "/",
  zValidator("query", notificationsQuerySchema),
  async (c) => {
    // pulling session info based on request headers
    const session = await auth.api.getSession({
      headers: c.req.header(),
    });

    // if no session(no logged in user), return unauthorized
    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }

    // check for active organization and if not found, return bad request
    const activeOrganizationId = session.session.activeOrganizationId;
    if (!activeOrganizationId) {
      return c.json({ error: "No active organization" }, { status: 400 });
    }

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
  },
);

export default app;
