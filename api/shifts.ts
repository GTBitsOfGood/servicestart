import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAdmin, requireMembership } from "@/lib/authUtils";
import { ShiftService } from "@/lib/services/ShiftService";
import {
  createShiftSchema,
  updateShiftSchema,
  shiftParamSchema,
} from "@/lib/shifts";
import shiftRsvpApp from "@/api/shifts/rsvps";
import { shiftErrorResponse } from "@/api/shifts/errors";

const app = new Hono()
  .post("/", zValidator("json", createShiftSchema), async (c) => {
    try {
      const { session, user } = await requireAdmin(c);
      const shift = await ShiftService.createShift(
        session.activeOrganizationId!,
        user.id,
        c.req.valid("json"),
      );
      return c.json({ status: 200, shift });
    } catch (error) {
      return shiftErrorResponse(c, error);
    }
  })
  .patch(
    "/:shiftId",
    zValidator("param", shiftParamSchema),
    zValidator("json", updateShiftSchema),
    async (c) => {
      try {
        const { session, user } = await requireAdmin(c);
        const shift = await ShiftService.updateShift(
          c.req.valid("param").shiftId,
          session.activeOrganizationId!,
          user.id,
          c.req.valid("json"),
        );
        return c.json({ success: true, shift });
      } catch (error) {
        return shiftErrorResponse(c, error);
      }
    },
  )
  .get("/:shiftId", zValidator("param", shiftParamSchema), async (c) => {
    try {
      const { session, user } = await requireMembership(c);
      const shift = await ShiftService.findById(
        c.req.valid("param").shiftId,
        session.activeOrganizationId!,
        user.id,
      );
      if (!shift) return c.json({ error: "Shift not found" }, 404);
      return c.json({ status: 200, shift });
    } catch (error) {
      return shiftErrorResponse(c, error);
    }
  })
  .delete("/:shiftId", zValidator("param", shiftParamSchema), async (c) => {
    try {
      const { session, user } = await requireAdmin(c);
      const shift = await ShiftService.deleteById(
        c.req.valid("param").shiftId,
        session.activeOrganizationId!,
        user.id,
      );
      return c.json({ success: true, shift });
    } catch (error) {
      return shiftErrorResponse(c, error);
    }
  })
  .route("", shiftRsvpApp);

export default app;
