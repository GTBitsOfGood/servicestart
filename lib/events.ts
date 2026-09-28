import { z } from "zod";
import { EventVisibility } from "@/lib/schema";

// Publication, visibility, and registration rules shared by the API routes,
// the server pages, and the registration server actions.

export type EventLike = {
  organizationId: string;
  visibility: string;
  publishedAt: Date | null;
  rsvpLimit: number | null;
  rsvpDeadline: Date | null;
};

export type Viewer = {
  organizationId: string | null;
  isMember: boolean;
  isAdmin: boolean;
};

const HH_MM_SS = /^(\d+):([0-5]\d):([0-5]\d)$/;
const UNIT_DURATION = /^(\d+(?:\.\d+)?)\s*(minute|minutes|hour|hours)$/i;

export function parseDurationMinutes(duration: string): number | null {
  const trimmed = duration.trim();

  const clock = HH_MM_SS.exec(trimmed);
  if (clock) {
    const [, hours, minutes, seconds] = clock;
    return Number(hours) * 60 + Number(minutes) + Number(seconds) / 60;
  }

  const unit = UNIT_DURATION.exec(trimmed);
  if (unit) {
    const [, amount, label] = unit;
    return label.toLowerCase().startsWith("hour")
      ? Number(amount) * 60
      : Number(amount);
  }

  return null;
}

export const timestampSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Must be a valid date and time",
  });

export const durationSchema = z
  .string()
  .refine((value) => (parseDurationMinutes(value) ?? 0) > 0, {
    message: "Duration must be a positive amount of time",
  });

const linkSchema = z.url({ message: "Links must be valid URLs" });

export const rsvpLimitSchema = z
  .number()
  .int("Capacity must be a whole number")
  .positive("Capacity must be greater than zero");

export const eventCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  location: z.string().trim(),
  startTimestamp: timestampSchema.nullable().optional(),
  duration: durationSchema.nullable().optional(),
  description: z.string().nullable().optional(),
  rsvpLimit: rsvpLimitSchema.nullable().optional(),
  rsvpDeadline: timestampSchema.nullable().optional(),
  visibility: z.enum(EventVisibility),
  accessibilityNotes: z.string().nullable().optional(),
  links: z.array(linkSchema).optional(),
  coverImageUrl: z.string().nullable().optional(),
  published: z.boolean().default(false),
  hosts: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
});

export const eventUpdateSchema = eventCreateSchema
  .omit({ published: true })
  .partial()
  .extend({ published: z.boolean().optional() });

export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;

// `current` lets a partial update be checked against the stored event.
export function validateEventDates(
  input: { startTimestamp?: string | null; rsvpDeadline?: string | null },
  current: {
    startTimestamp?: Date | null;
    rsvpDeadline?: Date | null;
  } = {},
): string | null {
  const start =
    input.startTimestamp !== undefined
      ? input.startTimestamp
        ? new Date(input.startTimestamp)
        : null
      : (current.startTimestamp ?? null);
  const deadline =
    input.rsvpDeadline !== undefined
      ? input.rsvpDeadline
        ? new Date(input.rsvpDeadline)
        : null
      : (current.rsvpDeadline ?? null);

  if (start && deadline && deadline.getTime() > start.getTime()) {
    return "Registration deadline must be on or before the event start time";
  }

  return null;
}

export function validateReadyToPublish(event: {
  startTimestamp: Date | null;
  duration: string | null;
  description: string | null;
  location: string;
}): string | null {
  if (event.location.trim() === "") {
    return "Add a location before publishing";
  }
  if (!event.startTimestamp) {
    return "Add a start date and time before publishing";
  }
  if (!event.duration) {
    return "Add a duration before publishing";
  }
  if (!event.description || event.description.trim() === "") {
    return "Add a description before publishing";
  }

  return null;
}

export function canViewEvent(event: EventLike, viewer: Viewer): boolean {
  const sameOrganization = viewer.organizationId === event.organizationId;

  if (event.publishedAt == null) {
    return sameOrganization && viewer.isAdmin;
  }

  if (event.visibility === EventVisibility.Public) {
    return true;
  }

  return sameOrganization && viewer.isMember;
}

export function canManageEvent(event: EventLike, viewer: Viewer): boolean {
  return viewer.organizationId === event.organizationId && viewer.isAdmin;
}

export type RegistrationBlock =
  | "not-visible"
  | "not-a-member"
  | "unpublished"
  | "deadline-passed"
  | "full";

export function publicationBlock(event: { publishedAt: Date | null }) {
  return event.publishedAt == null ? ("unpublished" as const) : null;
}

export function deadlineBlock(event: { rsvpDeadline: Date | null }, now: Date) {
  return event.rsvpDeadline && now.getTime() >= event.rsvpDeadline.getTime()
    ? ("deadline-passed" as const)
    : null;
}

export const registrationBlockMessages: Record<RegistrationBlock, string> = {
  "not-visible": "Event not found",
  "not-a-member": "User is not a member of this organization",
  unpublished: "This event is not published yet",
  "deadline-passed": "The registration deadline has passed",
  full: "This event has reached its capacity",
};
