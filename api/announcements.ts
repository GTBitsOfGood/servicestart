import { Hono } from "hono";
import z from "zod";
import { zValidator } from "@hono/zod-validator";
import { AnnouncementsService } from "@/lib/services/announcements";
import { auth } from "@/lib/auth";
import { MembersService } from "@/lib/services/members";
import { paginationQuerySchema } from "../lib/apiUtils";

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

      const { id } = await AnnouncementsService.createAnnouncement({
        ...data,
        publishedById: session.user.id,
        organizationId: activeOrganizationId,
      });

      return c.json({
        success: true,
        id,
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
        body: z.string().optional(),
        draft: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const { announcementId } = c.req.param();
      const { name, body, draft } = c.req.valid("json");

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

      const updated = await AnnouncementsService.updateAnnouncement({
        id: announcementId,
        organizationId: activeOrganizationId,
        userId: session.user.id,
        name,
        body,
        draft,
      });
      // e.g. the combination of (id, organizationId) does not match an announcement
      if (updated.length === 0) {
        return c.json({ error: "Announcement not found" }, { status: 404 });
      }
      return c.json(updated[0]);
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
