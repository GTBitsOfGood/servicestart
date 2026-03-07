import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import db from "@/lib/db";
import { messageRecipients, messages } from "@/lib/schema";
import { paginationQuerySchema } from "@/lib/apiUtils";
import { requireAdmin, requireMembership } from "@/lib/authUtils";
import { MembersService } from "@/lib/services/MemberService";
import { MessageService } from "@/lib/services/MessageService";

const messageQuerySchema = paginationQuerySchema.and(
  z.object({
    scope: z.enum(["self", "user", "all"]).optional(),
    userId: z.string().optional(),
  }),
);

const createMessageSchema = z.object({
  subject: z.string().min(1),
  body: z.record(z.string(), z.unknown()).optional(),
  textBody: z.string().optional(),
  htmlBody: z.string().optional(),
});

const app = new Hono()
  .get("/", zValidator("query", messageQuerySchema), async (c) => {
    const session = await requireMembership(c);
    const activeOrganizationId = session.session.activeOrganizationId!;

    const membership = await MembersService.findByUserAndOrganization(
      session.user.id,
      activeOrganizationId,
    );
    const isAdmin = MembersService.isAdminOrOwner(membership?.role);

    const { page, pageSize, scope, userId } = c.req.valid("query");
    const pagination = { limit: pageSize, offset: (page - 1) * pageSize };

    const selectMessages = (userId: string) =>
      db
        .select({
          id: messages.id,
          organizationId: messages.organizationId,
          senderId: messages.senderId,
          subject: messages.subject,
          body: messages.body,
          sentAt: messages.sentAt,
        })
        .from(messages)
        .innerJoin(
          messageRecipients,
          eq(messageRecipients.messageId, messages.id),
        )
        .where(
          and(
            eq(messages.organizationId, activeOrganizationId),
            eq(messageRecipients.userId, userId),
          ),
        )
        .orderBy(desc(messages.sentAt))
        .limit(pagination.limit)
        .offset(pagination.offset);

    if (!isAdmin || scope === "self") {
      const data = await selectMessages(session.user.id);
      return c.json({ data, page, pageSize });
    }

    if (scope === "user") {
      if (!userId) {
        return c.json(
          { error: "userId is required for scope=user" },
          { status: 400 },
        );
      }

      const targetMembership = await MembersService.findByUserAndOrganization(
        userId,
        activeOrganizationId,
      );

      if (!targetMembership) {
        return c.json(
          { error: "User is not in organization" },
          { status: 404 },
        );
      }

      const data = await selectMessages(userId);

      return c.json({ data, page, pageSize });
    }

    const data = await db
      .select({
        id: messages.id,
        organizationId: messages.organizationId,
        senderId: messages.senderId,
        subject: messages.subject,
        body: messages.body,
        sentAt: messages.sentAt,
      })
      .from(messages)
      .where(eq(messages.organizationId, activeOrganizationId))
      .orderBy(desc(messages.sentAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    return c.json({ data, page, pageSize });
  })
  .post("/", zValidator("json", createMessageSchema), async (c) => {
    const session = await requireAdmin(c);
    const activeOrganizationId = session.session.activeOrganizationId!;

    const data = c.req.valid("json");

    const message = await MessageService.createAndSend({
      organizationId: activeOrganizationId,
      senderId: session.user.id,
      subject: data.subject,
      body: data.body,
      textBody: data.textBody,
      htmlBody: data.htmlBody,
    });

    return c.json({ success: Boolean(message) });
  });

export default app;
