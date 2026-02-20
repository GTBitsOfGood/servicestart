import { Hono } from "hono";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { ShiftService } from "@/lib/services/ShiftService";
import { MembersService } from "@/lib/services/members";
import { EventService } from "@/lib/services/EventService";

const createShiftSchema = z.object({
  eventId: z.string().min(1, "eventId is required"),
  name: z.string().optional(),
  description: z.string().optional(),
  startTimestamp: z.string().optional(),
  duration: z.string().optional(),
  rsvpLimit: z.number().optional(),
});

const updateShiftSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  startTimestamp: z.string().optional(),
  duration: z.string().optional(),
  rsvpLimit: z.number().optional(),
  eventId: z.string().optional(),
});

const app = new Hono()
  .post("/", async (c) => {
    const session = await auth.api.getSession({
      headers: c.req.header(),
    });

    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.session.activeOrganizationId;
    if (!organizationId) {
      return c.json({ error: "No active organization" }, { status: 400 });
    }

    const membership = await MembersService.findByUserAndOrganization(
      session.user.id,
      organizationId,
    );

    if (!MembersService.isAdminOrOwner(membership?.role)) {
      return c.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown = {};
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }

    const parsed = createShiftSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid request body" }, { status: 400 });
    }

    const data = parsed.data;
    const event = await EventService.findById(data.eventId);
    if (!event || event.organizationId !== organizationId) {
      return c.json({ error: "Event not found" }, { status: 404 });
    }

    const startTimestamp =
      data.startTimestamp && !isNaN(new Date(data.startTimestamp).getTime())
        ? new Date(data.startTimestamp)
        : new Date();

    const shift = await ShiftService.createShift({
      organizationId,
      eventId: data.eventId,
      name: data.name || "",
      description: data.description || "",
      startTimestamp,
      duration: data.duration || "",
      rsvpLimit: data.rsvpLimit || 0,
    });

    return c.json({ status: 200, shift });
  })
  .patch("/:shiftId", async (c) => {
    const session = await auth.api.getSession({
      headers: c.req.header(),
    });

    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.session.activeOrganizationId;
    if (!organizationId) {
      return c.json({ error: "No active organization" }, { status: 400 });
    }

    const membership = await MembersService.findByUserAndOrganization(
      session.user.id,
      organizationId,
    );

    if (!MembersService.isAdminOrOwner(membership?.role)) {
      return c.json({ error: "Forbidden" }, { status: 403 });
    }

    const { shiftId } = c.req.param();
    let body: unknown = {};
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }

    const parsed = updateShiftSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid request body" }, { status: 400 });
    }

    const data = parsed.data;

    if (Object.keys(data).length === 0) {
      return c.json({ error: "No fields to update" }, { status: 400 });
    }

    if (data.eventId) {
      const event = await EventService.findById(data.eventId);
      if (!event || event.organizationId !== organizationId) {
        return c.json({ error: "Event not found" }, { status: 404 });
      }
    }

    const updates: {
      name?: string;
      description?: string;
      startTimestamp?: Date;
      duration?: string;
      rsvpLimit?: number;
      eventId?: string;
    } = {};

    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.startTimestamp !== undefined) {
      updates.startTimestamp = new Date(data.startTimestamp);
    }
    if (data.duration !== undefined) updates.duration = data.duration;
    if (data.rsvpLimit !== undefined) updates.rsvpLimit = data.rsvpLimit;
    if (data.eventId !== undefined) updates.eventId = data.eventId;

    await ShiftService.updateShift(shiftId, updates);
    const shift = await ShiftService.findById(shiftId);

    return c.json({ success: true, shift });
  })
  .get("/:shiftId", async (c) => {
    const session = await auth.api.getSession({
      headers: c.req.header(),
    });

    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.session.activeOrganizationId;
    if (!organizationId) {
      return c.json({ error: "No active organization" }, { status: 400 });
    }

    const { shiftId } = c.req.param();
    const shift = await ShiftService.findById(shiftId);

    if (!shift || shift.organizationId !== organizationId) {
      return c.json(
        { error: "Shift not found or unauthorized" },
        { status: 404 },
      );
    }

    return c.json({ status: 200, shift });
  })
  .delete("/:shiftId", async (c) => {
    const session = await auth.api.getSession({
      headers: c.req.header(),
    });

    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.session.activeOrganizationId;
    if (!organizationId) {
      return c.json({ error: "No active organization" }, { status: 400 });
    }

    const membership = await MembersService.findByUserAndOrganization(
      session.user.id,
      organizationId,
    );

    if (!MembersService.isAdminOrOwner(membership?.role)) {
      return c.json({ error: "Forbidden" }, { status: 403 });
    }

    const { shiftId } = c.req.param();
    const shift = await ShiftService.deleteById(shiftId);

    if (!shift) {
      return c.json({ error: "Shift not found" }, { status: 404 });
    }

    return c.json({ success: true, shift });
  });

export default app;
