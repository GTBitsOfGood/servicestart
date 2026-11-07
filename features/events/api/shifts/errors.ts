import type { Context } from "hono";
import { ZodError } from "zod";
import { ShiftError } from "@/features/events/lib/shifts";

export function shiftErrorResponse(c: Context, error: unknown) {
  if (error instanceof ShiftError) {
    const status =
      error.reason === "forbidden"
        ? 403
        : error.reason === "not-visible" || error.reason === "not-a-member"
          ? 404
          : error.reason === "full" ||
              error.reason === "capacity-too-small" ||
              error.reason === "shift-changed"
            ? 409
            : 400;
    return c.json({ error: error.message, reason: error.reason }, status);
  }
  if (error instanceof ZodError) {
    return c.json({ error: "Invalid request", issues: error.issues }, 400);
  }
  throw error;
}
