import { Hono } from "hono";
import z from "zod";
import { zValidator } from "@hono/zod-validator";
import { AnnouncementsService } from "@/lib/services/AnnouncementService";
import { auth } from "@/lib/auth";
import { EmailService } from "@/lib/services/EmailService";
import { MembersService } from "@/lib/services/MemberService";
import { paginationQuerySchema } from "../lib/apiUtils";

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
      const session = await auth.api.getSession({
        headers: c.req.header(),
      });

      if (!session?.user) {
        return c.json({ error: "Unauthorized" }, { status: 401 });
      }

      const activeOrganizationId = session.session.activeOrganizationId;

      if (!activeOrganizationId) {
        return c.json({ error: "No active organization" }, { status: 400 });
      }

      // Check if user is admin or owner of the active organization
      const membership = await MembersService.findByUserAndOrganization(
        session.user.id,
        activeOrganizationId,
      );

      if (!MembersService.isAdminOrOwner(membership?.role)) {
        return c.json(
          { error: "Forbidden: Admin or owner role required" },
          { status: 403 },
        );
      }

      const data = c.req.valid("json");

      const createdAnnouncement = await AnnouncementsService.createAnnouncement(
        {
          ...data,
          publishedById: session.user.id,
          organizationId: activeOrganizationId,
        },
      );

      if (createdAnnouncement.publishedAt) {
        const content = contentSchema.parse(createdAnnouncement.content);
        const text = content.find((c) => c.type === "text/plain")?.value ?? "";
        const html = content.find((c) => c.type === "text/html")?.value ?? "";

        await EmailService.emailMembers(activeOrganizationId, {
          subject: `New announcement: ${createdAnnouncement.name}`,
          textBody: text,
          htmlBody: html,
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
      const session = await auth.api.getSession({
        headers: c.req.header(),
      });

      if (!session?.user) {
        return c.json({ error: "Unauthorized" }, { status: 401 });
      }

      const activeOrganizationId = session.session.activeOrganizationId;

      if (!activeOrganizationId) {
        return c.json({ error: "No active organization" }, { status: 403 });
      }

      const { page, pageSize, draft } = c.req.valid("query");
      let onlyDrafts = false;
      if (draft) {
        const membership = await MembersService.findByUserAndOrganization(
          session.user.id,
          activeOrganizationId,
        );

        if (!MembersService.isAdminOrOwner(membership?.role)) {
          return c.json(
            { error: "Forbidden: Admin or owner role required" },
            { status: 403 },
          );
        }
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

    const session = await auth.api.getSession({
      headers: c.req.header(),
    });

    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { activeOrganizationId } = session.session;
    if (!activeOrganizationId) {
      return c.json({ error: "No active organization" }, { status: 403 });
    }

    const announcement = await AnnouncementsService.getById(announcementId);

    if (!announcement || announcement.organizationId !== activeOrganizationId) {
      return c.json({ error: "Announcement not found" }, { status: 404 });
    }
    if (announcement.isDraft) {
      const membership = await MembersService.findByUserAndOrganization(
        session.user.id,
        activeOrganizationId,
      );
      if (!MembersService.isAdminOrOwner(membership?.role)) {
        return c.json({ error: "Announcement not found" }, { status: 404 });
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

      const session = await auth.api.getSession({
        headers: c.req.header(),
      });

      if (!session?.user) {
        return c.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { activeOrganizationId } = session.session;
      if (!activeOrganizationId) {
        return c.json({ error: "No active organization" }, { status: 403 });
      }
      const membership = await MembersService.findByUserAndOrganization(
        session.user.id,
        activeOrganizationId,
      );

      if (!MembersService.isAdminOrOwner(membership?.role)) {
        return c.json(
          { error: "Forbidden: Admin or owner role required" },
          { status: 403 },
        );
      }

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
        return c.json({ error: "Announcement not found" }, { status: 404 });
      }

      if (
        !existingAnnouncement?.publishedAt &&
        updatedAnnouncement.publishedAt
      ) {
        const content = contentSchema.parse(updatedAnnouncement.content);
        const text = content.find((c) => c.type === "text/plain")?.value ?? "";
        const html = content.find((c) => c.type === "text/html")?.value ?? "";

        await EmailService.emailMembers(activeOrganizationId, {
          subject: `New announcement: ${updatedAnnouncement.name}`,
          textBody: text,
          htmlBody: html,
        });
      }

      return c.json(updatedAnnouncement);
    },
  )
  .delete("/:announcementId", async (c) => {
    const { announcementId } = c.req.param();
    const session = await auth.api.getSession({
      headers: c.req.header(),
    });
    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { activeOrganizationId } = session.session;
    if (!activeOrganizationId) {
      return c.json({ error: "No active organization" }, { status: 403 });
    }
    const membership = await MembersService.findByUserAndOrganization(
      session.user.id,
      activeOrganizationId,
    );
    if (!MembersService.isAdminOrOwner(membership?.role)) {
      return c.json(
        { error: "Forbidden: Admin or owner role required" },
        { status: 403 },
      );
    }
    const deleted = await AnnouncementsService.deleteAnnouncement(
      announcementId,
      activeOrganizationId,
    );
    if (deleted.length === 0) {
      return c.json({ error: "Announcement not found" }, { status: 404 });
    }
    return c.json(deleted[0]);
  });
export default app;
