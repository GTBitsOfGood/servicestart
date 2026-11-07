import { getSlugFromHost } from "@/core/tenant/host";
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from "@/core/api/errors";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { EventService } from "@/features/events/services/EventService";
import { MembersService } from "@/features/membership/server";
import { ShiftService } from "@/features/events/services/ShiftService";
import { requireAuth, requireMembership } from "@/core/auth/authUtils";
import { shiftErrorResponse } from "@/features/events/api/shifts/errors";
import { TagService } from "@/features/events/services/TagService";
import { paginationQuerySchema } from "@/core/api/apiUtils";

import { EventVisibility } from "@/features/events/schema";
import {
  canViewEvent,
  eventCreateSchema,
  eventUpdateSchema,
  registrationBlockMessages,
  timestampSchema,
  validateEventDates,
  validateReadyToPublish,
  type RegistrationBlock,
  type Viewer,
} from "@/features/events/lib/events";

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

const calendarQuerySchema = z
  .strictObject({
    start: timestampSchema,
    end: timestampSchema,
  })
  .refine(({ start, end }) => Date.parse(start) < Date.parse(end), {
    message: "End must be after start",
    path: ["end"],
  })
  .refine(
    ({ start, end }) => Date.parse(end) - Date.parse(start) <= 8 * 86_400_000,
    {
      message: "Calendar ranges cannot exceed eight days",
      path: ["end"],
    },
  );

const NOT_FOUND_BLOCKS: RegistrationBlock[] = ["not-visible", "not-a-member"];

const rsvpQuerySchema = z.object({
  userId: z.string().optional(),
});

async function getViewer(c: Context) {
  const session = await requireAuth(c);
  if (
    !session.session.activeOrganizationId &&
    getSlugFromHost(c.req.header("host"))
  ) {
    throw new ForbiddenError("No active organization");
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

async function resolveHostIds(emails: string[], organizationId: string) {
  const contacts = await MembersService.listMemberContacts(organizationId);
  const idsByEmail = new Map(contacts.map((c) => [c.email, c.userId]));
  const ids: string[] = [];

  for (const email of emails) {
    const userId = idsByEmail.get(email.trim().toLowerCase());

    if (!userId) {
      return { error: `${email} is not a member of this organization` };
    }

    ids.push(userId);
  }

  return { ids };
}

const app = new Hono()
  .post("/", zValidator("json", eventCreateSchema), async (c) => {
    const resolved = await getViewer(c);

    const { session, viewer } = resolved;
    const activeOrganizationId = viewer.organizationId;
    if (!activeOrganizationId) {
      throw new ForbiddenError("No active organization");
    }

    if (!viewer.isAdmin) {
      throw new ForbiddenError();
    }

    const data = c.req.valid("json");

    const dateError = validateEventDates(data);
    if (dateError) {
      throw new BadRequestError(dateError);
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
        throw new BadRequestError(publishError);
      }
    }

    const hosts = data.hosts ?? [];
    const resolvedHosts = await resolveHostIds(hosts, activeOrganizationId);
    if (resolvedHosts.error) {
      throw new NotFoundError(resolvedHosts.error);
    }

    if (data.tagIds && data.tagIds.length > 0) {
      const valid = await TagService.allBelongToOrg(
        data.tagIds,
        activeOrganizationId,
      );
      if (!valid) {
        throw new NotFoundError("At least one tag not in organization");
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
      throw new InternalServerError("Failed to create event");
    }

    if (resolvedHosts.ids && resolvedHosts.ids.length > 0) {
      await EventService.addEventHosts(event.id, resolvedHosts.ids);
    }

    return c.json(event);
  })
  .get("/", zValidator("query", eventsQuerySchema), async (c) => {
    const resolved = await getViewer(c);

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
  .get("/calendar", zValidator("query", calendarQuerySchema), async (c) => {
    const session = await requireMembership(c);
    const organizationId = session.session.activeOrganizationId!;
    const { start, end } = c.req.valid("query");
    const calendarEvents = await EventService.listPublishedInRange(
      organizationId,
      new Date(start),
      new Date(end),
    );

    return c.json({
      data: calendarEvents.map((event) => ({
        ...event,
        startTimestamp: event.startTimestamp!.toISOString(),
      })),
    });
  })
  .get("/:eventId", async (c) => {
    const { eventId } = c.req.param();
    const resolved = await getViewer(c);

    const event = await EventService.findById(eventId);
    if (
      !event ||
      (getSlugFromHost(c.req.header("host")) &&
        event.organizationId !== resolved.viewer.organizationId) ||
      !canViewEvent(event, resolved.viewer)
    ) {
      throw new NotFoundError("Event not found");
    }

    return c.json(event);
  })
  .get(
    "/:eventId/shifts",
    zValidator("param", z.object({ eventId: z.string().min(1) })),
    zValidator("query", paginationQuerySchema),
    async (c) => {
      try {
        const { eventId } = c.req.valid("param");
        const { session, user } = await requireMembership(c);
        const { page, pageSize } = c.req.valid("query");
        const data = await ShiftService.listByEvent(
          eventId,
          session.activeOrganizationId!,
          {
            limit: pageSize,
            offset: (page - 1) * pageSize,
          },
          user.id,
        );

        return c.json({
          data,
          page,
          pageSize,
        });
      } catch (error) {
        return shiftErrorResponse(c, error);
      }
    },
  )
  .patch("/:eventId", zValidator("json", eventUpdateSchema), async (c) => {
    const { eventId } = c.req.param();
    const resolved = await getViewer(c);

    const { session, viewer } = resolved;
    const activeOrganizationId = viewer.organizationId;
    if (!activeOrganizationId) {
      throw new ForbiddenError("No active organization");
    }

    if (!viewer.isAdmin) {
      throw new ForbiddenError();
    }

    const event = await EventService.findById(eventId);
    if (!event || event.organizationId !== activeOrganizationId) {
      throw new NotFoundError("Event not found");
    }

    const data = c.req.valid("json");

    const dateError = validateEventDates(data, event);
    if (dateError) {
      throw new BadRequestError(dateError);
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

    const isPublished = event.publishedAt != null;
    const willBePublished = data.published ?? isPublished;

    if (willBePublished) {
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
        throw new BadRequestError(publishError);
      }
    }

    if (willBePublished && !isPublished) {
      updates.publishedAt = new Date();
      updates.publishedById = session.user.id;
    } else if (!willBePublished && isPublished) {
      updates.publishedAt = null;
      updates.publishedById = null;
    }

    if (data.tagIds !== undefined && data.tagIds.length > 0) {
      const valid = await TagService.allBelongToOrg(
        data.tagIds,
        activeOrganizationId,
      );
      if (!valid) {
        throw new NotFoundError("At least one tag not in organization");
      }
    }

    let hostIds: string[] | undefined;
    if (data.hosts !== undefined) {
      const resolvedHosts = await resolveHostIds(
        data.hosts,
        activeOrganizationId,
      );
      if (resolvedHosts.error) {
        throw new NotFoundError(resolvedHosts.error);
      }
      hostIds = resolvedHosts.ids;
    }

    const updated = await EventService.updateEvent(
      eventId,
      activeOrganizationId,
      updates,
      { tagIds: data.tagIds, hostIds },
    );

    if (!updated) {
      throw new InternalServerError("Failed to update event");
    }

    return c.json(updated);
  })
  .delete("/:eventId", async (c) => {
    const { eventId } = c.req.param();
    const resolved = await getViewer(c);

    const { viewer } = resolved;
    const activeOrganizationId = viewer.organizationId;
    if (!activeOrganizationId) {
      throw new ForbiddenError("No active organization");
    }

    if (!viewer.isAdmin) {
      throw new ForbiddenError();
    }

    const deleted = await EventService.deleteById(
      eventId,
      activeOrganizationId,
    );

    if (!deleted) {
      throw new NotFoundError("Event not found");
    }

    return c.json({ success: true });
  })
  .post("/:eventId/rsvps", zValidator("query", rsvpQuerySchema), async (c) => {
    const { eventId } = c.req.param();
    const resolved = await getViewer(c);

    const { session, viewer } = resolved;
    const activeOrganizationId = viewer.organizationId;
    if (!activeOrganizationId) {
      throw new ForbiddenError("No active organization");
    }

    const event = await EventService.findById(eventId);
    if (
      !event ||
      event.organizationId !== activeOrganizationId ||
      !canViewEvent(event, viewer)
    ) {
      throw new NotFoundError("Event not found");
    }

    const { userId } = c.req.valid("query");
    const targetUserId = userId ?? session.user.id;

    if (targetUserId !== session.user.id && !viewer.isAdmin) {
      throw new ForbiddenError();
    }

    const result = await EventService.register(
      eventId,
      activeOrganizationId,
      targetUserId,
    );

    if (result !== "added" && result !== "already-registered") {
      return c.json(
        { error: registrationBlockMessages[result] },
        { status: NOT_FOUND_BLOCKS.includes(result) ? 404 : 400 },
      );
    }

    return c.json({
      eventId,
      userId: targetUserId,
      status: result,
    });
  })
  .delete(
    "/:eventId/rsvps",
    zValidator("query", rsvpQuerySchema),
    async (c) => {
      const { eventId } = c.req.param();
      const resolved = await getViewer(c);

      const { session, viewer } = resolved;
      const activeOrganizationId = viewer.organizationId;
      if (!activeOrganizationId) {
        throw new ForbiddenError("No active organization");
      }

      const event = await EventService.findById(eventId);
      if (
        !event ||
        event.organizationId !== activeOrganizationId ||
        !canViewEvent(event, viewer)
      ) {
        throw new NotFoundError("Event not found");
      }

      const { userId } = c.req.valid("query");
      const targetUserId = userId ?? session.user.id;

      if (targetUserId !== session.user.id && !viewer.isAdmin) {
        throw new ForbiddenError();
      }

      const result = await EventService.withdraw(
        eventId,
        activeOrganizationId,
        targetUserId,
      );

      if (result !== "removed") {
        return c.json(
          { error: registrationBlockMessages[result] },
          { status: NOT_FOUND_BLOCKS.includes(result) ? 404 : 400 },
        );
      }

      return c.json({
        eventId,
        userId: targetUserId,
        status: result,
      });
    },
  );

export default app;
