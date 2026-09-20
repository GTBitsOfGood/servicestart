import { EventVisibility } from "@/lib/schema";
import { parseDurationMinutes } from "@/lib/events";

export type EventFormValues = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  eventCapacity: string;
  deadline: string;
  links: string[];
  notes: string;
  tagIds: string[];
  hosts: string[];
  visibility: EventVisibility;
};

export const emptyEventFormValues: EventFormValues = {
  title: "",
  date: "",
  startTime: "",
  endTime: "",
  description: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  eventCapacity: "",
  deadline: "",
  links: [""],
  notes: "",
  tagIds: [],
  hosts: [""],
  visibility: EventVisibility.Public,
};

// Anything that is not "address, city, state, zip" stays in the address field.
export function parseLocation(location: string): {
  address: string;
  city: string;
  state: string;
  zipCode: string;
} {
  const parts = location.split(",").map((part) => part.trim());

  if (parts.length < 4) {
    return { address: location, city: "", state: "", zipCode: "" };
  }

  const [zipCode, state, city, ...addressParts] = [...parts].reverse();

  return {
    address: addressParts.reverse().join(", "),
    city,
    state,
    zipCode,
  };
}

export function composeLocation(values: EventFormValues): string {
  const parts = [
    values.address.trim(),
    values.city.trim(),
    values.state.trim(),
    values.zipCode.trim(),
  ].filter((part) => part !== "");

  return parts.join(", ");
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toTimeInputValue(date: Date): string {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${hours}:${minutes}`;
}

export type EventFormSource = {
  name: string;
  location: string;
  description: string | null;
  startTimestamp: string | null;
  duration: string | null;
  rsvpLimit: number | null;
  rsvpDeadline: string | null;
  visibility: string;
  accessibilityNotes: string | null;
  links: string[] | null;
  tagIds: string[];
  hosts: string[];
};

export function formValuesFromEvent(event: EventFormSource): EventFormValues {
  const start = event.startTimestamp ? new Date(event.startTimestamp) : null;
  const durationMinutes = event.duration
    ? parseDurationMinutes(event.duration)
    : null;
  const end =
    start && durationMinutes
      ? new Date(start.getTime() + durationMinutes * 60 * 1000)
      : null;
  const deadline = event.rsvpDeadline ? new Date(event.rsvpDeadline) : null;

  return {
    ...emptyEventFormValues,
    ...parseLocation(event.location),
    title: event.name,
    date: start ? toDateInputValue(start) : "",
    startTime: start ? toTimeInputValue(start) : "",
    endTime: end ? toTimeInputValue(end) : "",
    description: event.description ?? "",
    eventCapacity: event.rsvpLimit !== null ? String(event.rsvpLimit) : "",
    deadline: deadline ? toDateInputValue(deadline) : "",
    links: event.links && event.links.length > 0 ? event.links : [""],
    notes: event.accessibilityNotes ?? "",
    tagIds: event.tagIds,
    hosts: event.hosts.length > 0 ? event.hosts : [""],
    visibility:
      event.visibility === EventVisibility.Member
        ? EventVisibility.Member
        : EventVisibility.Public,
  };
}

export type EventFormField =
  | "title"
  | "date"
  | "startTime"
  | "endTime"
  | "description"
  | "address"
  | "city"
  | "state"
  | "zipCode"
  | "eventCapacity"
  | "deadline"
  | "links";

type RequiredEventFormField = Exclude<EventFormField, "links">;

const PUBLISH_REQUIRED_FIELDS: RequiredEventFormField[] = [
  "title",
  "date",
  "startTime",
  "endTime",
  "description",
  "address",
  "city",
  "state",
  "zipCode",
];

export type EventPayload = {
  name: string;
  location: string;
  startTimestamp: string | null;
  duration: string | null;
  description: string | null;
  visibility: EventVisibility;
  rsvpLimit: number | null;
  rsvpDeadline: string | null;
  accessibilityNotes: string | null;
  links: string[];
  hosts: string[];
  tagIds: string[];
};

export type BuildPayloadResult =
  | { ok: true; payload: EventPayload }
  | { ok: false; missing: EventFormField[]; message: string };

// Drafts only need a title; publishing requires the full details.
export function buildEventPayload(
  values: EventFormValues,
  intent: "draft" | "publish",
): BuildPayloadResult {
  const required: RequiredEventFormField[] =
    intent === "publish" ? PUBLISH_REQUIRED_FIELDS : ["title"];
  const missing = required.filter((field) => values[field].trim() === "");

  if (missing.length > 0) {
    return {
      ok: false,
      missing,
      message:
        intent === "publish"
          ? "Please fill out all required fields before publishing"
          : "A draft still needs a title",
    };
  }

  let startTimestamp: string | null = null;
  let duration: string | null = null;

  if (values.date !== "" && values.startTime !== "" && values.endTime !== "") {
    const start = new Date(`${values.date}T${values.startTime}`);
    const end = new Date(`${values.date}T${values.endTime}`);
    const minutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));

    if (Number.isNaN(minutes)) {
      return {
        ok: false,
        missing: ["date"],
        message: "Enter a valid date and time",
      };
    }

    if (minutes <= 0) {
      return {
        ok: false,
        missing: ["startTime", "endTime"],
        message: "Start time must be before end time",
      };
    }

    startTimestamp = start.toISOString();
    duration = `${minutes} minutes`;
  } else if (values.date !== "" && values.startTime !== "") {
    startTimestamp = new Date(
      `${values.date}T${values.startTime}`,
    ).toISOString();
  }

  let rsvpLimit: number | null = null;
  if (values.eventCapacity.trim() !== "") {
    const parsed = Number(values.eventCapacity);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return {
        ok: false,
        missing: ["eventCapacity"],
        message: "Capacity must be a whole number greater than zero",
      };
    }
    rsvpLimit = parsed;
  }

  let rsvpDeadline: string | null = null;
  if (values.deadline.trim() !== "") {
    const parsed = new Date(`${values.deadline}T23:59:59`);
    if (Number.isNaN(parsed.getTime())) {
      return {
        ok: false,
        missing: ["deadline"],
        message: "Enter a valid registration deadline",
      };
    }
    if (
      startTimestamp &&
      parsed.getTime() > new Date(startTimestamp).getTime()
    ) {
      return {
        ok: false,
        missing: ["deadline"],
        message:
          "Registration deadline must be on or before the event start time",
      };
    }
    rsvpDeadline = parsed.toISOString();
  }

  const links = values.links.map((link) => link.trim()).filter((l) => l !== "");
  const invalidLink = links.find((link) => !URL.canParse(link));
  if (invalidLink) {
    return {
      ok: false,
      missing: ["links"],
      message: `${invalidLink} is not a valid URL`,
    };
  }

  return {
    ok: true,
    payload: {
      name: values.title.trim(),
      location: composeLocation(values),
      startTimestamp,
      duration,
      description: values.description.trim() === "" ? null : values.description,
      visibility: values.visibility,
      rsvpLimit,
      rsvpDeadline,
      accessibilityNotes: values.notes.trim() === "" ? null : values.notes,
      links,
      hosts: values.hosts.map((h) => h.trim()).filter((h) => h !== ""),
      tagIds: values.tagIds,
    },
  };
}
