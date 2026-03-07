import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { auth } from "@/lib/auth";
import { EventService } from "@/lib/services/EventService";
import { MembersService } from "@/lib/services/MemberService";
import { ShiftService } from "@/lib/services/ShiftService";
import { paginationQuerySchema } from "../lib/apiUtils";
import { ForbiddenError } from "@/lib/errors";

export const eventsQuerySchema = paginationQuerySchema.extend({
  published: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
});

const app = new Hono()
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1, "Name is required"),
        location: z.string().min(1, "Location is required"),
        startTimestamp: z.string().nullable().optional(),
        duration: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        coverImageUrl: z.string().nullable().optional(),
        published: z.boolean().default(false),
      }),
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
      const membership = await MembersService.findByUserAndOrganization(
        session.user.id,
        activeOrganizationId,
      );

      if (!MembersService.isAdminOrOwner(membership?.role)) {
        throw new ForbiddenError();
      }

      const data = c.req.valid("json");
      const publishedAt = data.published ? new Date() : null;
      const publishedById = data.published ? session.user.id : null;

      const event = await EventService.create(
        activeOrganizationId,
        data.name,
        data.location,
        data.startTimestamp ? new Date(data.startTimestamp) : null,
        data.duration ?? null,
        data.description ?? null,
        data.coverImageUrl ?? null,
        publishedAt,
        publishedById,
      );

      if (!event) {
        return c.json({ error: "Failed to create event" }, { status: 500 });
      }

      return c.json(event);
    },
  )
  .get("/", zValidator("query", eventsQuerySchema), async (c) => {
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

    const membership = await MembersService.findByUserAndOrganization(
      session.user.id,
      activeOrganizationId,
    );

    if (!MembersService.isAdminOrOwner(membership?.role)) {
      const { page, pageSize } = c.req.valid("query");
      const eventsList = await EventService.listByOrganization(
        activeOrganizationId,
        { limit: pageSize, offset: (page - 1) * pageSize },
        true,
      );

      return c.json({
        data: eventsList,
        page,
        pageSize,
      });
    }

    const { page, pageSize, published } = c.req.valid("query");
    if (published !== undefined) {
      const eventsList = await EventService.listByOrganization(
        activeOrganizationId,
        { limit: pageSize, offset: (page - 1) * pageSize },
        published,
      );

      return c.json({
        data: eventsList,
        page,
        pageSize,
      });
    }

    const eventsList = await EventService.listByOrganization(
      activeOrganizationId,
      { limit: pageSize, offset: (page - 1) * pageSize },
    );

    return c.json({
      data: eventsList,
      page,
      pageSize,
    });
  })
  .get("/:eventId", async (c) => {
    const { eventId } = c.req.param();
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

    const event = await EventService.findById(eventId);

    if (!event || event.organizationId !== activeOrganizationId) {
      return c.json({ error: "Event not found" }, { status: 404 });
    }

    const membership = await MembersService.findByUserAndOrganization(
      session.user.id,
      activeOrganizationId,
    );

    if (
      event.publishedAt == null &&
      !MembersService.isAdminOrOwner(membership?.role)
    ) {
      throw new ForbiddenError();
    }

    return c.json(event);
  })
  .get(
    "/:eventId/shifts",
    zValidator("query", paginationQuerySchema),
    async (c) => {
      const { eventId } = c.req.param();
      const session = await auth.api.getSession({
        headers: c.req.header(),
      });

      if (!session?.user) {
        return c.json({ error: "Unauthorized" }, { status: 401 });
      }

      const activeOrganizationId = session.session.activeOrganizationId;
      if (!activeOrganizationId) {
        return c.json({ error: "Event not found" }, { status: 404 });
      }

      const event = await EventService.findById(eventId);
      if (!event || event.organizationId !== activeOrganizationId) {
        return c.json({ error: "Event not found" }, { status: 404 });
      }

      const membership = await MembersService.findByUserAndOrganization(
        session.user.id,
        activeOrganizationId,
      );

      if (
        event.publishedAt == null &&
        !MembersService.isAdminOrOwner(membership?.role)
      ) {
        throw new ForbiddenError();
      }

      const { page, pageSize } = c.req.valid("query");
      const data = await ShiftService.listByEvent(
        eventId,
        activeOrganizationId,
        {
          limit: pageSize,
          offset: (page - 1) * pageSize,
        },
      );

      return c.json({
        data,
        page,
        pageSize,
      });
    },
  )
  .patch(
    "/:eventId",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1).optional(),
        location: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        startTimestamp: z.string().nullable().optional(),
        duration: z.string().nullable().optional(),
        coverImageUrl: z.string().nullable().optional(),
        published: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const { eventId } = c.req.param();
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

      const membership = await MembersService.findByUserAndOrganization(
        session.user.id,
        activeOrganizationId,
      );

      if (!MembersService.isAdminOrOwner(membership?.role)) {
        throw new ForbiddenError();
      }

      const event = await EventService.findById(eventId);
      if (!event || event.organizationId !== activeOrganizationId) {
        return c.json({ error: "Event not found" }, { status: 404 });
      }

      const data = c.req.valid("json");
      const updates: {
        name?: string;
        location?: string;
        description?: string | null;
        startTimestamp?: Date | null;
        duration?: string | null;
        coverImageUrl?: string | null;
        publishedAt?: Date | null;
        publishedById?: string | null;
      } = {};

      if (data.name !== undefined) updates.name = data.name;
      if (data.location !== undefined) updates.location = data.location;
      if (data.description !== undefined) {
        updates.description = data.description;
      }
      if (data.startTimestamp !== undefined) {
        updates.startTimestamp = data.startTimestamp
          ? new Date(data.startTimestamp)
          : null;
      }
      if (data.duration !== undefined) {
        updates.duration = data.duration;
      }
      if (data.coverImageUrl !== undefined) {
        updates.coverImageUrl = data.coverImageUrl;
      }
      if (data.published !== undefined) {
        if (event.publishedAt == null) {
          if (data.published) {
            updates.publishedAt = new Date();
            updates.publishedById = session.user.id;
          }
        } else {
          if (!data.published) {
            updates.publishedAt = null;
            updates.publishedById = null;
          }
        }
      }

      const updated = await EventService.updateEvent(
        eventId,
        activeOrganizationId,
        updates,
      );

      if (!updated) {
        return c.json({ error: "Failed to update event" }, { status: 500 });
      }

      return c.json(updated);
    },
  )
  .delete("/:eventId", async (c) => {
    const { eventId } = c.req.param();
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

    const membership = await MembersService.findByUserAndOrganization(
      session.user.id,
      activeOrganizationId,
    );

    if (!MembersService.isAdminOrOwner(membership?.role)) {
      throw new ForbiddenError();
    }

    const deleted = await EventService.deleteById(
      eventId,
      activeOrganizationId,
    );

    if (!deleted) {
      return c.json({ error: "Event not found" }, { status: 404 });
    }

    return c.json({ success: true });
  })
  .post(
    "/:eventId/rsvps",
    zValidator(
      "query",
      z.object({
        userId: z.string().optional(),
      }),
    ),
    async (c) => {
      const { eventId } = c.req.param();
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

      const event = await EventService.findById(eventId);
      if (!event || event.organizationId !== activeOrganizationId) {
        return c.json({ error: "Event not found" }, { status: 404 });
      }

      const membership = await MembersService.findByUserAndOrganization(
        session.user.id,
        activeOrganizationId,
      );

      if (
        event.publishedAt == null &&
        !MembersService.isAdminOrOwner(membership?.role)
      ) {
        throw new ForbiddenError();
      }

      const { userId } = c.req.valid("query");
      const targetUserId = userId ?? session.user.id;

      if (userId && userId !== session.user.id) {
        if (!MembersService.isAdminOrOwner(membership?.role)) {
          throw new ForbiddenError();
        }
      }

      const targetMembership = await MembersService.findByUserAndOrganization(
        targetUserId,
        activeOrganizationId,
      );

      if (!targetMembership) {
        return c.json(
          { error: "User is not a member of this organization" },
          { status: 404 },
        );
      }

      await EventService.addRSVP(eventId, targetUserId);

      return c.json({
        eventId,
        userId: targetUserId,
        status: "added",
      });
    },
  )
  .delete(
    "/:eventId/rsvps",
    zValidator(
      "query",
      z.object({
        userId: z.string().optional(),
      }),
    ),
    async (c) => {
      const { eventId } = c.req.param();
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

      const event = await EventService.findById(eventId);
      if (!event || event.organizationId !== activeOrganizationId) {
        return c.json({ error: "Event not found" }, { status: 404 });
      }

      const membership = await MembersService.findByUserAndOrganization(
        session.user.id,
        activeOrganizationId,
      );

      if (
        event.publishedAt == null &&
        !MembersService.isAdminOrOwner(membership?.role)
      ) {
        throw new ForbiddenError();
      }

      const { userId } = c.req.valid("query");
      const targetUserId = userId ?? session.user.id;

      if (userId && userId !== session.user.id) {
        if (!MembersService.isAdminOrOwner(membership?.role)) {
          throw new ForbiddenError();
        }
      }

      const targetMembership = await MembersService.findByUserAndOrganization(
        targetUserId,
        activeOrganizationId,
      );

      if (!targetMembership) {
        return c.json(
          { error: "User is not a member of this organization" },
          { status: 404 },
        );
      }

      await EventService.deleteRSVP(eventId, targetUserId);

      return c.json({
        eventId,
        userId: targetUserId,
        status: "removed",
      });
    },
  );

export default app;
