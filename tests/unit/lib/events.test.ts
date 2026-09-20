// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  canManageEvent,
  canViewEvent,
  parseDurationMinutes,
  registrationBlockFor,
  validateEventDates,
  validateReadyToPublish,
  withdrawalBlockFor,
  type EventLike,
  type Viewer,
} from "@/lib/events";
import { EventVisibility } from "@/lib/schema";

const ORG = "org-1";
const OTHER_ORG = "org-2";

function buildEvent(overrides: Partial<EventLike> = {}): EventLike {
  return {
    organizationId: ORG,
    visibility: EventVisibility.Public,
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    rsvpLimit: null,
    rsvpDeadline: null,
    ...overrides,
  };
}

const admin: Viewer = { organizationId: ORG, isMember: true, isAdmin: true };
const member: Viewer = { organizationId: ORG, isMember: true, isAdmin: false };
const outsider: Viewer = {
  organizationId: OTHER_ORG,
  isMember: true,
  isAdmin: true,
};
const signedOut: Viewer = {
  organizationId: null,
  isMember: false,
  isAdmin: false,
};

describe("parseDurationMinutes", () => {
  it("reads the clock form Postgres returns", () => {
    expect(parseDurationMinutes("01:30:00")).toBe(90);
  });

  it("reads the unit form the form writes", () => {
    expect(parseDurationMinutes("90 minutes")).toBe(90);
    expect(parseDurationMinutes("2 hours")).toBe(120);
  });

  it("returns null for anything else", () => {
    expect(parseDurationMinutes("a while")).toBeNull();
  });
});

describe("canViewEvent", () => {
  it("lets anyone see a published public event", () => {
    const event = buildEvent();

    expect(canViewEvent(event, signedOut)).toBe(true);
    expect(canViewEvent(event, outsider)).toBe(true);
  });

  it("limits published member-only events to members of the owning org", () => {
    const event = buildEvent({ visibility: EventVisibility.Member });

    expect(canViewEvent(event, member)).toBe(true);
    expect(canViewEvent(event, outsider)).toBe(false);
    expect(canViewEvent(event, signedOut)).toBe(false);
  });

  it("limits drafts to admins of the owning org", () => {
    const event = buildEvent({ publishedAt: null });

    expect(canViewEvent(event, admin)).toBe(true);
    expect(canViewEvent(event, member)).toBe(false);
    expect(canViewEvent(event, outsider)).toBe(false);
  });
});

describe("canManageEvent", () => {
  it("only allows admins of the owning organization", () => {
    const event = buildEvent();

    expect(canManageEvent(event, admin)).toBe(true);
    expect(canManageEvent(event, member)).toBe(false);
    expect(canManageEvent(event, outsider)).toBe(false);
  });
});

describe("registrationBlockFor", () => {
  it("allows a member to register for an open event", () => {
    expect(registrationBlockFor(buildEvent(), member, 0)).toBeNull();
  });

  it("blocks non-members", () => {
    expect(registrationBlockFor(buildEvent(), outsider, 0)).toBe(
      "not-a-member",
    );
  });

  it("blocks drafts", () => {
    const draft = buildEvent({ publishedAt: null });

    expect(registrationBlockFor(draft, admin, 0)).toBe("unpublished");
  });

  it("blocks once the deadline has passed", () => {
    const event = buildEvent({
      rsvpDeadline: new Date("2026-01-02T00:00:00Z"),
    });

    expect(
      registrationBlockFor(event, member, 0, new Date("2026-01-03T00:00:00Z")),
    ).toBe("deadline-passed");
  });

  it("blocks once the event is full", () => {
    const event = buildEvent({ rsvpLimit: 2 });

    expect(registrationBlockFor(event, member, 2)).toBe("full");
    expect(registrationBlockFor(event, member, 1)).toBeNull();
  });
});

describe("withdrawalBlockFor", () => {
  it("allows withdrawal before the deadline", () => {
    const event = buildEvent({
      rsvpDeadline: new Date("2026-01-05T00:00:00Z"),
    });

    expect(
      withdrawalBlockFor(event, member, new Date("2026-01-04T00:00:00Z")),
    ).toBeNull();
  });

  it("closes withdrawal at the same moment registration closes", () => {
    const event = buildEvent({
      rsvpDeadline: new Date("2026-01-05T00:00:00Z"),
    });

    expect(
      withdrawalBlockFor(event, member, new Date("2026-01-05T00:00:00Z")),
    ).toBe("deadline-passed");
  });
});

describe("validateEventDates", () => {
  it("rejects a deadline after the start time", () => {
    expect(
      validateEventDates({
        startTimestamp: "2026-06-01T10:00:00Z",
        rsvpDeadline: "2026-06-02T10:00:00Z",
      }),
    ).toMatch(/deadline/i);
  });

  it("accepts a deadline on or before the start time", () => {
    expect(
      validateEventDates({
        startTimestamp: "2026-06-01T10:00:00Z",
        rsvpDeadline: "2026-05-30T10:00:00Z",
      }),
    ).toBeNull();
  });

  it("checks a partial update against the stored event", () => {
    expect(
      validateEventDates(
        { rsvpDeadline: "2026-06-05T10:00:00Z" },
        { startTimestamp: new Date("2026-06-01T10:00:00Z") },
      ),
    ).toMatch(/deadline/i);
  });
});

describe("validateReadyToPublish", () => {
  const ready = {
    startTimestamp: new Date("2026-06-01T10:00:00Z"),
    duration: "60 minutes",
    description: "Come along",
    location: "123 Peachtree St, Atlanta, GA, 30308",
  };

  it("accepts a complete event", () => {
    expect(validateReadyToPublish(ready)).toBeNull();
  });

  it("rejects an event that is missing scheduling details", () => {
    expect(validateReadyToPublish({ ...ready, startTimestamp: null })).toMatch(
      /start date/i,
    );
    expect(validateReadyToPublish({ ...ready, duration: null })).toMatch(
      /duration/i,
    );
    expect(validateReadyToPublish({ ...ready, description: "" })).toMatch(
      /description/i,
    );
    expect(validateReadyToPublish({ ...ready, location: "  " })).toMatch(
      /location/i,
    );
  });
});
