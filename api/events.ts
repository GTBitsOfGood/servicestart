import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { auth } from "@/lib/auth";
import { EventService } from "@/lib/services/EventService";
import { MembersService } from "@/lib/services/MemberService";
import { ShiftService } from "@/lib/services/ShiftService";
import { TagService } from "@/lib/services/TagService";
import { UserService } from "@/lib/services/UserService";
import { paginationQuerySchema } from "../lib/apiUtils";
import { ForbiddenError } from "@/lib/errors";
import { EventVisibility } from "@/lib/schema";
import {
  canViewEvent,
  eventCreateSchema,
  eventUpdateSchema,
  registrationBlockMessages,
  registrationWindowBlock,
  validateEventDates,
  validateReadyToPublish,
  withdrawalWindowBlock,
  type Viewer,
} from "@/lib/events";

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

const rsvpQuerySchema = z.object({
  userId: z.string().optional(),
});

/**
 * Resolves the caller's session together with the membership facts the event
 * rules need. Returns null when the caller is not signed in.
 */
async function getViewer(c: Context) {
  const session = await auth.api.getSession({ headers: c.req.header() });

  if (!session?.user) {
    return null;
  }

  const organizationId = session.session.activeOrganizationId ?? null;
  const membership = organizationId
    ? await MembersService.findByUserAndOrganization(
        session.user.id,
        organizationId,
      )
    : null;

  const viewer: Viewer = {
    organizationId,
    isMember: membership != null,
    isAdmin: MembersService.isAdminOrOwner(membership?.role),
  };

  return { session, viewer };
}

/**
 * Turns host emails into user IDs, rejecting anyone who is not a member of the
 * organization.
 */
async function resolveHostIds(emails: string[], organizationId: string) {
  const ids: string[] = [];

  for (const email of emails) {
    const user = await UserService.findByEmailAndOrganization(
      email,
      organizationId,
    );

    if (!user) {
      return { error: `No user found with email ${email}` };
    }

    const membership = await MembersService.findByUserAndOrganization(
      user.id,
      organizationId,
    );

    if (!membership) {
      return { error: `${email} is not a member of this organization` };
    }

    ids.push(user.id);
  }

  return { ids };
}

const app = new Hono()
  .post("/", zValidator("json", eventCreateSchema), async (c) => {
    const resolved = await getViewer(c);
    if (!resolved) {
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { session, viewer } = resolved;
    const activeOrganizationId = viewer.organizationId;
    if (!activeOrganizationId) {
      return c.json({ error: "No active organization" }, { status: 403 });
    }

    if (!viewer.isAdmin) {
      throw new ForbiddenError();
    }

    const data = c.req.valid("json");

    const dateError = validateEventDates(data);
    if (dateError) {
      return c.json({ error: dateError }, { status: 400 });
    }

    if (data.published) {
      const publishError = validateReadyToPublish({
        startTimestamp: data.startTimestamp
          ? new Date(data.startTimestamp)
          : null,
        duration: data.duration ?? null,
        description: data.description ?? null,
        location: data.location,
      });

      if (publishError) {
        return c.json({ error: publishError }, { status: 400 });
      }
    }

    const hosts = data.hosts ?? [];
    const resolvedHosts = await resolveHostIds(hosts, activeOrganizationId);
    if (resolvedHosts.error) {
      return c.json({ error: resolvedHosts.error }, { status: 404 });
    }

    if (data.tagIds && data.tagIds.length > 0) {
      const valid = await TagService.allBelongToOrg(
        data.tagIds,
        activeOrganizationId,
      );
      if (!valid) {
        return c.json(
          { error: "At least one tag not in organization" },
          { status: 404 },
        );
      }
    }

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
      data.rsvpLimit ?? null,
      data.rsvpDeadline ? new Date(data.rsvpDeadline) : null,
      data.visibility,
      data.accessibilityNotes ?? null,
      data.links ?? null,
      publishedAt,
      publishedById,
      data.tagIds,
    );

    if (!event) {
      return c.json({ error: "Failed to create event" }, { status: 500 });
    }

    if (resolvedHosts.ids && resolvedHosts.ids.length > 0) {
      await EventService.addEventHosts(event.id, resolvedHosts.ids);
    }

    return c.json(event);
  })
  .get("/", zValidator("query", eventsQuerySchema), async (c) => {
    const resolved = await getViewer(c);
    if (!resolved) {
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { viewer } = resolved;
    const { page, pageSize, published } = c.req.valid("query");
    const pagination = { limit: pageSize, offset: (page - 1) * pageSize };

    if (!viewer.organizationId) {
      return c.json({
        data: await EventService.listByPublic(pagination),
        page,
        pageSize,
      });
    }

    const eventsList = await EventService.listByOrganization(
      viewer.organizationId,
      pagination,
      { published: viewer.isAdmin ? published : true },
    );

    return c.json({
      data: eventsList,
      page,
      pageSize,
    });
  })
  .get("/:eventId", async (c) => {
    const { eventId } = c.req.param();
    const resolved = await getViewer(c);
    if (!resolved) {
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }

    const event = await EventService.findById(eventId);
    if (!event || !canViewEvent(event, resolved.viewer)) {
      return c.json({ error: "Event not found" }, { status: 404 });
    }

    return c.json(event);
  })
  .get(
    "/:eventId/shifts",
    zValidator("query", paginationQuerySchema),
    async (c) => {
      const { eventId } = c.req.param();
      const resolved = await getViewer(c);
      if (!resolved) {
        return c.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { viewer } = resolved;
      const activeOrganizationId = viewer.organizationId;
      if (!activeOrganizationId) {
        return c.json({ error: "Event not found" }, { status: 404 });
      }

      const event = await EventService.findById(eventId);
      if (
        !event ||
        event.organizationId !== activeOrganizationId ||
        !canViewEvent(event, viewer)
      ) {
        return c.json({ error: "Event not found" }, { status: 404 });
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
  .patch("/:eventId", zValidator("json", eventUpdateSchema), async (c) => {
    const { eventId } = c.req.param();
    const resolved = await getViewer(c);
    if (!resolved) {
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { session, viewer } = resolved;
    const activeOrganizationId = viewer.organizationId;
    if (!activeOrganizationId) {
      return c.json({ error: "No active organization" }, { status: 403 });
    }

    if (!viewer.isAdmin) {
      throw new ForbiddenError();
    }

    const event = await EventService.findById(eventId);
    if (!event || event.organizationId !== activeOrganizationId) {
      return c.json({ error: "Event not found" }, { status: 404 });
    }

    const data = c.req.valid("json");

    const dateError = validateEventDates(data, event);
    if (dateError) {
      return c.json({ error: dateError }, { status: 400 });
    }

    const updates: {
      name?: string;
      location?: string;
      description?: string | null;
      startTimestamp?: Date | null;
      duration?: string | null;
      coverImageUrl?: string | null;
      publishedAt?: Date | null;
      publishedById?: string | null;
      rsvpLimit?: number | null;
      rsvpDeadline?: Date | null;
      visibility?: EventVisibility;
      accessibilityNotes?: string | null;
      links?: string[] | null;
    } = {};

    if (data.name !== undefined) updates.name = data.name;
    if (data.location !== undefined) updates.location = data.location;
    if (data.description !== undefined) updates.description = data.description;
    if (data.duration !== undefined) updates.duration = data.duration;
    if (data.coverImageUrl !== undefined) {
      updates.coverImageUrl = data.coverImageUrl;
    }
    if (data.rsvpLimit !== undefined) updates.rsvpLimit = data.rsvpLimit;
    if (data.visibility !== undefined) updates.visibility = data.visibility;
    if (data.accessibilityNotes !== undefined) {
      updates.accessibilityNotes = data.accessibilityNotes;
    }
    if (data.links !== undefined) updates.links = data.links;
    if (data.startTimestamp !== undefined) {
      updates.startTimestamp = data.startTimestamp
        ? new Date(data.startTimestamp)
        : null;
    }
    if (data.rsvpDeadline !== undefined) {
      updates.rsvpDeadline = data.rsvpDeadline
        ? new Date(data.rsvpDeadline)
        : null;
    }

    if (data.published !== undefined) {
      const isPublished = event.publishedAt != null;

      if (data.published && !isPublished) {
        const publishError = validateReadyToPublish({
          startTimestamp:
            updates.startTimestamp !== undefined
              ? updates.startTimestamp
              : event.startTimestamp,
          duration:
            updates.duration !== undefined ? updates.duration : event.duration,
          description:
            updates.description !== undefined
              ? updates.description
              : event.description,
          location:
            updates.location !== undefined ? updates.location : event.location,
        });

        if (publishError) {
          return c.json({ error: publishError }, { status: 400 });
        }

        updates.publishedAt = new Date();
        updates.publishedById = session.user.id;
      } else if (!data.published && isPublished) {
        updates.publishedAt = null;
        updates.publishedById = null;
      }
    }

    if (data.tagIds !== undefined && data.tagIds.length > 0) {
      const valid = await TagService.allBelongToOrg(
        data.tagIds,
        activeOrganizationId,
      );
      if (!valid) {
        return c.json(
          { error: "At least one tag not in organization" },
          { status: 404 },
        );
      }
    }

    let hostIds: string[] | undefined;
    if (data.hosts !== undefined) {
      const resolvedHosts = await resolveHostIds(
        data.hosts,
        activeOrganizationId,
      );
      if (resolvedHosts.error) {
        return c.json({ error: resolvedHosts.error }, { status: 404 });
      }
      hostIds = resolvedHosts.ids;
    }

    const updated = await EventService.updateEvent(
      eventId,
      activeOrganizationId,
      updates,
    );

    if (!updated) {
      return c.json({ error: "Failed to update event" }, { status: 500 });
    }

    if (data.tagIds !== undefined) {
      await EventService.setEventTags(eventId, data.tagIds);
    }

    if (hostIds !== undefined) {
      await EventService.setEventHosts(eventId, hostIds);
    }

    return c.json(updated);
  })
  .delete("/:eventId", async (c) => {
    const { eventId } = c.req.param();
    const resolved = await getViewer(c);
    if (!resolved) {
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { viewer } = resolved;
    const activeOrganizationId = viewer.organizationId;
    if (!activeOrganizationId) {
      return c.json({ error: "No active organization" }, { status: 403 });
    }

    if (!viewer.isAdmin) {
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
  .post("/:eventId/rsvps", zValidator("query", rsvpQuerySchema), async (c) => {
    const { eventId } = c.req.param();
    const resolved = await getViewer(c);
    if (!resolved) {
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { session, viewer } = resolved;
    const activeOrganizationId = viewer.organizationId;
    if (!activeOrganizationId) {
      return c.json({ error: "No active organization" }, { status: 403 });
    }

    const event = await EventService.findById(eventId);
    if (
      !event ||
      event.organizationId !== activeOrganizationId ||
      !canViewEvent(event, viewer)
    ) {
      return c.json({ error: "Event not found" }, { status: 404 });
    }

    const { userId } = c.req.valid("query");
    const targetUserId = userId ?? session.user.id;

    if (targetUserId !== session.user.id && !viewer.isAdmin) {
      throw new ForbiddenError();
    }

    const targetMembership = await MembersService.findByUserAndOrganization(
      targetUserId,
      activeOrganizationId,
    );

    if (!targetMembership) {
      return c.json(
        { error: registrationBlockMessages["not-a-member"] },
        { status: 404 },
      );
    }

    const rsvpCount = await EventService.countRSVPs(eventId);
    const block = registrationWindowBlock(event, rsvpCount);
    if (block) {
      return c.json(
        { error: registrationBlockMessages[block] },
        { status: 400 },
      );
    }

    const result = await EventService.addRSVP(eventId, targetUserId);

    if (result === "full") {
      return c.json({ error: registrationBlockMessages.full }, { status: 400 });
    }

    if (result === "not-found") {
      return c.json({ error: "Event not found" }, { status: 404 });
    }

    return c.json({
      eventId,
      userId: targetUserId,
      status: result === "already-registered" ? "already-registered" : "added",
    });
  })
  .delete(
    "/:eventId/rsvps",
    zValidator("query", rsvpQuerySchema),
    async (c) => {
      const { eventId } = c.req.param();
      const resolved = await getViewer(c);
      if (!resolved) {
        return c.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { session, viewer } = resolved;
      const activeOrganizationId = viewer.organizationId;
      if (!activeOrganizationId) {
        return c.json({ error: "No active organization" }, { status: 403 });
      }

      const event = await EventService.findById(eventId);
      if (
        !event ||
        event.organizationId !== activeOrganizationId ||
        !canViewEvent(event, viewer)
      ) {
        return c.json({ error: "Event not found" }, { status: 404 });
      }

      const { userId } = c.req.valid("query");
      const targetUserId = userId ?? session.user.id;

      if (targetUserId !== session.user.id && !viewer.isAdmin) {
        throw new ForbiddenError();
      }

      const targetMembership = await MembersService.findByUserAndOrganization(
        targetUserId,
        activeOrganizationId,
      );

      if (!targetMembership) {
        return c.json(
          { error: registrationBlockMessages["not-a-member"] },
          { status: 404 },
        );
      }

      const block = withdrawalWindowBlock(event);
      if (block) {
        return c.json(
          { error: registrationBlockMessages[block] },
          { status: 400 },
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
