import { requireMembership } from "@/lib/authUtils";
import { ForbiddenError } from "@/lib/errors";
import { MembersService } from "@/lib/services/members";
import { ShiftService } from "@/lib/services/ShiftService";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import z from "zod";

const app = new Hono()
  .post(
    "/:shiftId/rsvps",
    zValidator(
      "query",
      z.object({
        userId: z.string().optional(),
      }),
    ),
    async (c) => {
      const { session, user } = await requireMembership(c);

      const organizationId = session.activeOrganizationId;

      if (!organizationId) {
        return c.json({ error: "No active organization" }, { status: 400 });
      }

      const { shiftId } = c.req.param();
      const shift = await ShiftService.findById(shiftId);

      if (!shift) {
        return c.notFound();
      }

      if (shift.organizationId !== organizationId) {
        return c.notFound();
      }

      const userId = c.req.valid("query").userId;

      if (userId) {
        const membership = await MembersService.findByUserAndOrganization(
          userId,
          organizationId,
        );

        if (!MembersService.isAdminOrOwner(membership?.role)) {
          return c.json({ error: "Forbidden" }, { status: 403 });
        }

        if (membership) {
          await ShiftService.addRSVP(shiftId, userId);
        }
      } else {
        await ShiftService.addRSVP(shiftId, user.id);
        return c.json({ success: true });
      }

      return c.json({ success: true });
    },
  )
  .delete(
    "/:shiftId/rsvps",
    zValidator(
      "query",
      z.object({
        userId: z.string().optional(),
      }),
    ),
    async (c) => {
      const { session, user } = await requireMembership(c);
      const organizationId = session.activeOrganizationId;

      const { shiftId } = c.req.param();
      const shift = await ShiftService.findById(shiftId);

      if (!shift) {
        return c.notFound();
      }

      if (shift.organizationId !== organizationId) {
        return c.notFound();
      }

      const userId = c.req.valid("query").userId;

      if (userId) {
        const membership = await MembersService.findByUserAndOrganization(
          userId,
          organizationId,
        );

        if (!MembersService.isAdminOrOwner(membership?.role)) {
          return c.json({ error: "Forbidden" }, { status: 403 });
        }

        if (membership) {
          await ShiftService.deleteRSVP(shiftId, userId);
        }
      } else {
        await ShiftService.deleteRSVP(shiftId, user.id);
        return c.json({ success: true });
      }

      return c.json({ success: true });
    },
  );

export default app;
