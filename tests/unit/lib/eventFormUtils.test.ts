// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildEventPayload,
  composeLocation,
  emptyEventFormValues,
  formValuesFromEvent,
  parseLocation,
  type EventFormValues,
} from "@/lib/eventFormUtils";
import { EventVisibility } from "@/lib/schema";

function completeValues(
  overrides: Partial<EventFormValues> = {},
): EventFormValues {
  return {
    ...emptyEventFormValues,
    title: "Community Picnic",
    date: "2026-06-15",
    startTime: "14:00",
    endTime: "16:30",
    description: "Bring a dish",
    address: "123 Peachtree St",
    city: "Atlanta",
    state: "GA",
    zipCode: "30308",
    ...overrides,
  };
}

describe("parseLocation", () => {
  it("splits a composed location back into its parts", () => {
    expect(parseLocation("123 Peachtree St, Atlanta, GA, 30308")).toEqual({
      address: "123 Peachtree St",
      city: "Atlanta",
      state: "GA",
      zipCode: "30308",
    });
  });

  it("keeps commas that belong to the street address", () => {
    expect(
      parseLocation("123 Peachtree St, Suite 5, Atlanta, GA, 30308"),
    ).toEqual({
      address: "123 Peachtree St, Suite 5",
      city: "Atlanta",
      state: "GA",
      zipCode: "30308",
    });
  });

  it("falls back to the address field for free-form locations", () => {
    expect(parseLocation("The old library")).toEqual({
      address: "The old library",
      city: "",
      state: "",
      zipCode: "",
    });
  });
});

describe("composeLocation", () => {
  it("round-trips with parseLocation", () => {
    const location = "123 Peachtree St, Atlanta, GA, 30308";

    expect(
      composeLocation({ ...emptyEventFormValues, ...parseLocation(location) }),
    ).toBe(location);
  });
});

describe("buildEventPayload", () => {
  it("accepts a draft that only has a title", () => {
    const result = buildEventPayload(
      { ...emptyEventFormValues, title: "Untitled idea" },
      "draft",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.startTimestamp).toBeNull();
    expect(result.payload.duration).toBeNull();
    expect(result.payload.location).toBe("");
  });

  it("refuses a draft with no title", () => {
    const result = buildEventPayload(emptyEventFormValues, "draft");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain("title");
  });

  it("requires the full details to publish", () => {
    const result = buildEventPayload(
      { ...emptyEventFormValues, title: "Untitled idea" },
      "publish",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual(
      expect.arrayContaining(["date", "startTime", "description", "city"]),
    );
  });

  it("builds a duration from the start and end times", () => {
    const result = buildEventPayload(completeValues(), "publish");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.duration).toBe("150 minutes");
    expect(result.payload.location).toBe(
      "123 Peachtree St, Atlanta, GA, 30308",
    );
    expect(result.payload.visibility).toBe(EventVisibility.Public);
  });

  it("rejects an end time that is not after the start time", () => {
    const result = buildEventPayload(
      completeValues({ startTime: "16:00", endTime: "15:00" }),
      "publish",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/start time must be before end time/i);
  });

  it("rejects a capacity that is not a positive whole number", () => {
    for (const eventCapacity of ["0", "-3", "2.5", "many"]) {
      const result = buildEventPayload(
        completeValues({ eventCapacity }),
        "publish",
      );

      expect(result.ok).toBe(false);
    }
  });

  it("rejects a deadline after the event starts", () => {
    const result = buildEventPayload(
      completeValues({ deadline: "2026-06-20" }),
      "publish",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/deadline/i);
  });

  it("rejects links that are not URLs", () => {
    const result = buildEventPayload(
      completeValues({ links: ["not a url"] }),
      "publish",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain("links");
  });

  it("drops empty links and hosts", () => {
    const result = buildEventPayload(
      completeValues({
        links: ["https://example.org", "  "],
        hosts: ["host@example.org", ""],
      }),
      "publish",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.links).toEqual(["https://example.org"]);
    expect(result.payload.hosts).toEqual(["host@example.org"]);
  });
});

describe("formValuesFromEvent", () => {
  it("fills the form from a stored event", () => {
    const start = new Date(2026, 5, 15, 14, 0, 0);

    const values = formValuesFromEvent({
      name: "Community Picnic",
      location: "123 Peachtree St, Atlanta, GA, 30308",
      description: "Bring a dish",
      startTimestamp: start.toISOString(),
      duration: "01:30:00",
      rsvpLimit: 25,
      rsvpDeadline: new Date(2026, 5, 10, 12, 0, 0).toISOString(),
      visibility: EventVisibility.Member,
      accessibilityNotes: "Step-free access",
      links: ["https://example.org"],
      tagIds: ["tag-1"],
      hosts: ["host@example.org"],
    });

    expect(values.title).toBe("Community Picnic");
    expect(values.date).toBe("2026-06-15");
    expect(values.startTime).toBe("14:00");
    expect(values.endTime).toBe("15:30");
    expect(values.city).toBe("Atlanta");
    expect(values.eventCapacity).toBe("25");
    expect(values.deadline).toBe("2026-06-10");
    expect(values.visibility).toBe(EventVisibility.Member);
    expect(values.links).toEqual(["https://example.org"]);
    expect(values.hosts).toEqual(["host@example.org"]);
  });

  it("leaves a sparse draft's fields blank", () => {
    const values = formValuesFromEvent({
      name: "Draft idea",
      location: "",
      description: null,
      startTimestamp: null,
      duration: null,
      rsvpLimit: null,
      rsvpDeadline: null,
      visibility: EventVisibility.Public,
      accessibilityNotes: null,
      links: null,
      tagIds: [],
      hosts: [],
    });

    expect(values.date).toBe("");
    expect(values.endTime).toBe("");
    expect(values.links).toEqual([""]);
    expect(values.hosts).toEqual([""]);
  });
});
