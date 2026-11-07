import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "@/core/api/errors";
import {
  requireAuth,
  requireAdmin,
  requireAdminSession,
} from "@/core/auth/authUtils";
import { Hono } from "hono";
import z from "zod";
import { zValidator } from "@hono/zod-validator";
import { AnnouncementsService } from "@/features/communications/services/AnnouncementService";
import { EmailService } from "@/core/email/EmailService";
import { MembersService } from "@/features/membership/server";
import { paginationQuerySchema } from "@/core/api/apiUtils";

const contentSchema = z.array(
  z.object({ type: z.enum(["text/plain", "text/html"]), value: z.string() }),
);

const app = new Hono()
  .post(
    "/",
    zValidator(
      "json",
      AnnouncementsService.insertSchema
        .omit({
          createdAt: true,
          organizationId: true,
          publishedById: true,
        })
        .and(z.object({ draft: z.boolean() })),
    ),
    async (c) => {
      const session = await requireAdmin(
        c,
        "Forbidden: Admin or owner role required",
      );
      const activeOrganizationId = session.session.activeOrganizationId!;

      const data = c.req.valid("json");

      const createdAnnouncement = await AnnouncementsService.createAnnouncement(
        {
          ...data,
          publishedById: session.user.id,
          organizationId: activeOrganizationId,
        },
      );

      if (createdAnnouncement.publishedAt) {
        const content = contentSchema.safeParse(createdAnnouncement.content);
        if (!content.success) {
          throw new BadRequestError("Invalid content format");
        }
        const data = content.data;

        await EmailService.emailMembers(activeOrganizationId, {
          subject: `New announcement: ${createdAnnouncement.name}`,
          content: data,
        });
      }

      return c.json({
        success: true,
        id: createdAnnouncement.id,
      });
    },
  )
  .get(
    "/",
    zValidator(
      "query",
      paginationQuerySchema.and(
        z.object({
          draft: z.coerce.boolean().default(false),
        }),
      ),
    ),
    async (c) => {
      const session = await requireAuth(c);

      const activeOrganizationId = session.session.activeOrganizationId;

      if (!activeOrganizationId) {
        throw new ForbiddenError("No active organization");
      }

      const { page, pageSize, draft } = c.req.valid("query");
      let onlyDrafts = false;
      if (draft) {
        await requireAdminSession(
          session,
          "Forbidden: Admin or owner role required",
        );
        onlyDrafts = true;
      }

      return c.json(
        await AnnouncementsService.listByOrganization(
          activeOrganizationId,
          onlyDrafts,
          { limit: pageSize, offset: (page - 1) * pageSize },
        ),
      );
    },
  )
  .get("/:announcementId", async (c) => {
    const { announcementId } = c.req.param();

    const session = await requireAuth(c);
    const { activeOrganizationId } = session.session;
    if (!activeOrganizationId) {
      throw new ForbiddenError("No active organization");
    }

    const announcement = await AnnouncementsService.getById(announcementId);

    if (!announcement || announcement.organizationId !== activeOrganizationId) {
      throw new NotFoundError("Announcement not found");
    }
    if (announcement.isDraft) {
      const membership = await MembersService.findByUserAndOrganization(
        session.user.id,
        activeOrganizationId,
      );
      if (!MembersService.isAdminOrOwner(membership?.role)) {
        throw new NotFoundError("Announcement not found");
      }
    }

    return c.json(announcement);
  })
  .patch(
    "/:announcementId",
    zValidator(
      "json",
      z.object({
        name: z.string().optional(),
        draft: z.boolean().optional(),
        content: contentSchema.optional(),
        subject: z.string().optional(),
        template: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const { announcementId } = c.req.param();
      const { name, content, subject, template, draft } = c.req.valid("json");

      const session = await requireAuth(c);
      const { activeOrganizationId } = session.session;
      if (!activeOrganizationId) {
        throw new ForbiddenError("No active organization");
      }
      await requireAdminSession(
        session,
        "Forbidden: Admin or owner role required",
      );

      const existingAnnouncement =
        await AnnouncementsService.getById(announcementId);

      const updatedAnnouncement = await AnnouncementsService.updateAnnouncement(
        {
          id: announcementId,
          organizationId: activeOrganizationId,
          userId: session.user.id,
          name,
          content,
          subject,
          template,
          draft,
        },
      );
      if (!updatedAnnouncement) {
        throw new NotFoundError("Announcement not found");
      }

      if (
        !existingAnnouncement?.publishedAt &&
        updatedAnnouncement.publishedAt
      ) {
        const content = contentSchema.safeParse(updatedAnnouncement.content);
        if (!content.success) {
          throw new BadRequestError("Invalid content format");
        }
        const data = content.data;

        await EmailService.emailMembers(activeOrganizationId, {
          subject: `New announcement: ${updatedAnnouncement.name}`,
          content: data,
        });
      }

      return c.json(updatedAnnouncement);
    },
  )
  .delete("/:announcementId", async (c) => {
    const { announcementId } = c.req.param();
    const session = await requireAuth(c);
    const { activeOrganizationId } = session.session;
    if (!activeOrganizationId) {
      throw new ForbiddenError("No active organization");
    }
    await requireAdminSession(
      session,
      "Forbidden: Admin or owner role required",
    );
    const deleted = await AnnouncementsService.deleteAnnouncement(
      announcementId,
      activeOrganizationId,
    );
    if (deleted.length === 0) {
      throw new NotFoundError("Announcement not found");
    }
    return c.json(deleted[0]);
  });
export default app;
