import { z } from "zod";
import {
  durationSchema,
  rsvpLimitSchema,
  timestampSchema,
  registrationBlockMessages,
  type RegistrationBlock,
} from "@/lib/events";

export const shiftParamSchema = z.object({ shiftId: z.string().min(1) });
export const shiftRsvpQuerySchema = z.object({
  userId: z.string().min(1).optional(),
});
export const createShiftSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().optional(),
  description: z.string().optional(),
  startTimestamp: timestampSchema,
  duration: durationSchema,
  rsvpLimit: rsvpLimitSchema
    .max(2_147_483_647, "Capacity exceeds the supported maximum")
    .nullable()
    .optional(),
});
export const updateShiftSchema = createShiftSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "No fields to update",
  });

export type ShiftFailure =
  | RegistrationBlock
  | "forbidden"
  | "capacity-too-small"
  | "shift-changed";
export class ShiftError extends Error {
  constructor(public readonly reason: ShiftFailure) {
    super(shiftFailureMessages[reason]);
  }
}

export const shiftFailureMessages: Record<ShiftFailure, string> = {
  ...registrationBlockMessages,
  "not-visible": "Shift or parent event not found",
  full: "This shift has reached its capacity",
  forbidden: "Forbidden",
  "capacity-too-small": "Capacity cannot be lower than current attendance",
  "shift-changed": "The shift changed during this request; please retry",
};
