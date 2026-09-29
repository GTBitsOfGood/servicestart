import { requireMembership } from "@/lib/authUtils";
import { ShiftService } from "@/lib/services/ShiftService";
import { shiftParamSchema, shiftRsvpQuerySchema } from "@/lib/shifts";
import { shiftErrorResponse } from "@/api/shifts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

const app = new Hono()
  .post(
    "/:shiftId/rsvps",
    zValidator("param", shiftParamSchema),
    zValidator("query", shiftRsvpQuerySchema),
    async (c) => {
      try {
        const { session, user } = await requireMembership(c);
        await ShiftService.register(
          c.req.valid("param").shiftId,
          session.activeOrganizationId!,
          user.id,
          c.req.valid("query").userId,
        );
        return c.json({ success: true });
      } catch (error) {
        return shiftErrorResponse(c, error);
      }
    },
  )
  .delete(
    "/:shiftId/rsvps",
    zValidator("param", shiftParamSchema),
    zValidator("query", shiftRsvpQuerySchema),
    async (c) => {
      try {
        const { session, user } = await requireMembership(c);
        await ShiftService.withdraw(
          c.req.valid("param").shiftId,
          session.activeOrganizationId!,
          user.id,
          c.req.valid("query").userId,
        );
        return c.json({ success: true });
      } catch (error) {
        return shiftErrorResponse(c, error);
      }
    },
  );

export default app;
