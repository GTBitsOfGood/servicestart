// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  addMember,
  buildTestUser,
  createEvent,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
  testApi,
} from "@/tests/unit/testUtils";

const query = {
  start: "2026-11-02T05:00:00.000Z",
  end: "2026-11-09T05:00:00.000Z",
};

describe("GET /api/events/calendar", () => {
  it("requires a signed-in organization member", async () => {
    const response = await testApi.events.calendar.$get({ query });

    expect(response.status).toBe(401);
  });

  it("returns only published events from the active organization", async () => {
    const organization = await createOrganization("calendar-api-active");
    const otherOrganization = await createOrganization("calendar-api-other");
    const { user, session, headers } =
      await signUpAndGetSession(buildTestUser());
    await setActiveOrganization(session.id, organization.id);
    await addMember(user.id, organization.id, "member");

    const visibleId = await createEvent(organization.id, {
      name: "Leadership Workshop",
      startTimestamp: new Date("2026-11-02T15:00:00.000Z"),
    });
    await createEvent(organization.id, {
      name: "Unpublished Workshop",
      startTimestamp: new Date("2026-11-03T15:00:00.000Z"),
      publishedAt: null,
    });
    await createEvent(otherOrganization.id, {
      name: "Other Organization Workshop",
      startTimestamp: new Date("2026-11-04T15:00:00.000Z"),
    });

    const response = await testApi.events.calendar.$get({ query }, { headers });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [
        {
          id: visibleId,
          name: "Leadership Workshop",
          startTimestamp: "2026-11-02T15:00:00.000Z",
        },
      ],
    });
  });

  it("rejects ranges longer than eight days", async () => {
    const organization = await createOrganization("calendar-api-range");
    const { user, session, headers } =
      await signUpAndGetSession(buildTestUser());
    await setActiveOrganization(session.id, organization.id);
    await addMember(user.id, organization.id, "member");

    const response = await testApi.events.calendar.$get(
      {
        query: {
          start: query.start,
          end: "2026-11-11T05:00:00.000Z",
        },
      },
      { headers },
    );

    expect(response.status).toBe(400);
  });
});
