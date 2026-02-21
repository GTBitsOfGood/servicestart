import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import db from "@/lib/db";
import { shiftRSVPs } from "@/lib/schema";
import { ShiftService } from "@/lib/services/ShiftService";
import {
  addMember,
  buildTestUser,
  createOrganization,
  createEvent,
  setActiveOrganization,
  signUpAndGetSession,
  createShift,
  createShiftRSVP,
} from "@/tests/unit/testUtils";
import app from "@/app/api/[[...route]]/route";
import {
  POST as POST_RSVP,
  DELETE as DELETE_RSVP,
} from "@/app/api/shifts/[shiftId]/rsvps/route";

function withJsonHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  nextHeaders.set("Content-Type", "application/json");
  return nextHeaders;
}

describe("POST /app/api/shifts", () => {
  it("returns 401 if not logged in", async () => {
    const response = await app.request("/api/shifts", {
      method: "POST",
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 if lacks permissions", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "member");
    await setActiveOrganization(session.id, organization.id);

    const response = await app.request("/api/shifts", {
      method: "POST",
      headers: withJsonHeaders(headers),
    });
    expect(response.status).toBe(403);
  });

  it("creates a shift", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);
    const eventId = await createEvent(organization.id);

    const response = await app.request("/api/shifts", {
      method: "POST",
      headers: withJsonHeaders(headers),
      body: JSON.stringify({
        eventId,
        name: "Test Shift",
        description: "A test shift",
        startTimestamp: new Date().toISOString(),
        duration: "2 hours",
        rsvpLimit: 10,
      }),
    });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.shift.name).toBe("Test Shift");
  });

  it("returns 404 if event not found", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);

    const response = await app.request("/api/shifts", {
      method: "POST",
      headers: withJsonHeaders(headers),
      body: JSON.stringify({
        eventId: "missing-event",
        name: "Test Shift",
        description: "A test shift",
      }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 404 if event not in active organization", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const otherOrganization = await createOrganization("other");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);
    const eventId = await createEvent(otherOrganization.id);

    const response = await app.request("/api/shifts", {
      method: "POST",
      headers: withJsonHeaders(headers),
      body: JSON.stringify({
        eventId,
        name: "Test Shift",
        description: "A test shift",
      }),
    });
    expect(response.status).toBe(404);
  });
});

describe("PATCH /app/api/shifts/[shiftId]", () => {
  it("returns 401 if not logged in", async () => {
    const response = await app.request("/api/shifts/1234", {
      method: "PATCH",
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 if lacks permissions", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "member");
    await setActiveOrganization(session.id, organization.id);
    const shiftId = await createShift(organization.id, { name: "Old Shift" });

    const response = await app.request(`/api/shifts/${shiftId}`, {
      method: "PATCH",
      headers: withJsonHeaders(headers),
    });
    expect(response.status).toBe(403);
  });

  it("updates a shift", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);
    const shiftId = await createShift(organization.id, { name: "Old Shift" });

    const response = await app.request(`/api/shifts/${shiftId}`, {
      method: "PATCH",
      headers: withJsonHeaders(headers),
      body: JSON.stringify({
        name: "Test Shift",
      }),
    });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.shift.name).toBe("Test Shift");
  });

  it("updates the shift event", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);
    const shiftId = await createShift(organization.id, { name: "Old Shift" });
    const eventId = await createEvent(organization.id);

    const response = await app.request(`/api/shifts/${shiftId}`, {
      method: "PATCH",
      headers: withJsonHeaders(headers),
      body: JSON.stringify({
        eventId,
      }),
    });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.shift.eventId).toBe(eventId);
  });

  it("returns 404 if new event not found", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);
    const shiftId = await createShift(organization.id, { name: "Old Shift" });

    const response = await app.request(`/api/shifts/${shiftId}`, {
      method: "PATCH",
      headers: withJsonHeaders(headers),
      body: JSON.stringify({
        eventId: "missing-event",
      }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 404 if new event not in active organization", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const otherOrganization = await createOrganization("other");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);
    const shiftId = await createShift(organization.id, { name: "Old Shift" });
    const eventId = await createEvent(otherOrganization.id);

    const response = await app.request(`/api/shifts/${shiftId}`, {
      method: "PATCH",
      headers: withJsonHeaders(headers),
      body: JSON.stringify({
        eventId,
      }),
    });
    expect(response.status).toBe(404);
  });

  it("doesn't update organizationId", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);
    const shiftId = await createShift(organization.id, { name: "Old Shift" });

    const response = await app.request(`/api/shifts/${shiftId}`, {
      method: "PATCH",
      headers: withJsonHeaders(headers),
      body: JSON.stringify({
        organizationId: "update-id",
        name: "Test Shift",
      }),
    });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.shift.organizationId).toBe(organization.id);
    expect(data.shift.name).toBe("Test Shift");
  });
});

describe("DELETE /app/api/shifts/[shiftId]", () => {
  it("returns 401 if not logged in", async () => {
    const response = await app.request("/api/shifts/1234", {
      method: "DELETE",
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 if lacks permissions", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "member");
    await setActiveOrganization(session.id, organization.id);
    const shiftId = await createShift(organization.id, { name: "Old Shift" });

    const response = await app.request(`/api/shifts/${shiftId}`, {
      method: "DELETE",
      headers,
    });
    expect(response.status).toBe(403);
  });

  it("deletes a shift", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);
    const shiftId = await createShift(organization.id, { name: "Test Shift" });

    const response = await app.request(`/api/shifts/${shiftId}`, {
      method: "DELETE",
      headers,
    });

    expect(response.status).toBe(200);
    expect(await ShiftService.findById(shiftId)).toBe(null);
  });

  it("returns 404 if shift doesn't exist", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);

    const response = await app.request("/api/shifts/1234", {
      method: "DELETE",
      headers,
    });
    expect(response.status).toBe(404);
  });
});

describe("GET /app/api/shifts/[shiftId]", () => {
  it("returns 401 if not logged in", async () => {
    const response = await app.request("/api/shifts/1234", {
      method: "GET",
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 if active organization is not shift's", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);
    const shiftId = await createShift(organization.id, { name: "Test Shift" });

    const diffOrg = await createOrganization("diff");
    await addMember(user.id, diffOrg.id, "admin");
    await setActiveOrganization(session.id, diffOrg.id);

    const response = await app.request(`/api/shifts/${shiftId}`, {
      method: "GET",
      headers,
    });
    expect(response.status).toBe(404);
  });

  it("returns the shift", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);
    const shiftId = await createShift(organization.id, { name: "Test Shift" });

    const response = await app.request(`/api/shifts/${shiftId}`, {
      method: "GET",
      headers,
    });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.shift.name).toBe("Test Shift");
  });

  it("returns 404 if shift doesn't exist", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);

    const response = await app.request("/api/shifts/1234", {
      method: "GET",
      headers,
    });
    expect(response.status).toBe(404);
  });
});

describe("POST /app/api/shifts/[shiftId]/rsvps", () => {
  it("returns 401 if not logged in", async () => {
    const request = new Request("http://localhost/api/shifts/1234/rsvps", {
      method: "POST",
    });

    const response = await POST_RSVP(request, {
      params: Promise.resolve({ shiftId: "1234" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 if active organization is not shift's", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);
    const shiftId = await createShift(organization.id, { name: "Test Shift" });

    const diffOrg = await createOrganization("diff");
    await addMember(user.id, diffOrg.id, "admin");
    await setActiveOrganization(session.id, diffOrg.id);

    const request = new Request(
      `http://localhost/api/shifts/${shiftId}/rsvps`,
      {
        method: "POST",
        headers,
      },
    );

    const response = await POST_RSVP(request, {
      params: Promise.resolve({ shiftId }),
    });
    expect(response.status).toBe(404);
  });

  it("userId is not specified", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);
    const shiftId = await createShift(organization.id, { name: "Test Shift" });

    const request = new Request(
      `http://localhost/api/shifts/${shiftId}/rsvps`,
      {
        method: "POST",
        headers,
      },
    );

    const response = await POST_RSVP(request, {
      params: Promise.resolve({ shiftId }),
    });
    expect(response.status).toBe(200);

    const rsvp = await db
      .select()
      .from(shiftRSVPs)
      .where(
        and(eq(shiftRSVPs.shiftId, shiftId), eq(shiftRSVPs.userId, user.id)),
      );

    expect(rsvp.length).toBe(1);
  });

  it("returns 403 if userId is specified but user lacks permissions", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "member");
    await setActiveOrganization(session.id, organization.id);
    const shiftId = await createShift(organization.id, { name: "Test Shift" });

    const request = new Request(
      `http://localhost/api/shifts/${shiftId}/rsvps?userId=${user.id}`,
      {
        method: "POST",
        headers,
      },
    );

    const response = await POST_RSVP(request, {
      params: Promise.resolve({ shiftId }),
    });
    expect(response.status).toBe(403);
  });

  it("add RSVP for specified user", async () => {
    const theUser = await buildTestUser();
    const anotherUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    const { user: user2 } = await signUpAndGetSession(anotherUser);
    await addMember(user.id, organization.id, "admin");
    await addMember(user2.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);
    const shiftId = await createShift(organization.id, { name: "Test Shift" });

    const request = new Request(
      `http://localhost/api/shifts/${shiftId}/rsvps?userId=${user2.id}`,
      {
        method: "POST",
        headers,
      },
    );

    const response = await POST_RSVP(request, {
      params: Promise.resolve({ shiftId }),
    });
    expect(response.status).toBe(200);

    const rsvp = await db
      .select()
      .from(shiftRSVPs)
      .where(
        and(eq(shiftRSVPs.shiftId, shiftId), eq(shiftRSVPs.userId, user2.id)),
      );

    expect(rsvp.length).toBe(1);
  });
});

describe("DELETE /app/api/shifts/[shiftId]/rsvps", () => {
  it("returns 401 if not logged in", async () => {
    const request = new Request("http://localhost/api/shifts/1234/rsvps", {
      method: "DELETE",
    });

    const response = await DELETE_RSVP(request, {
      params: Promise.resolve({ shiftId: "1234" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 if active organization is not shift's", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);
    const shiftId = await createShift(organization.id, { name: "Test Shift" });

    const diffOrg = await createOrganization("diff");
    await addMember(user.id, diffOrg.id, "admin");
    await setActiveOrganization(session.id, diffOrg.id);

    const request = new Request(
      `http://localhost/api/shifts/${shiftId}/rsvps`,
      {
        method: "DELETE",
        headers,
      },
    );

    const response = await DELETE_RSVP(request, {
      params: Promise.resolve({ shiftId }),
    });
    expect(response.status).toBe(404);
  });

  it("userId is not specified", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);
    const shiftId = await createShift(organization.id, { name: "Test Shift" });
    await createShiftRSVP(shiftId, user.id);

    const request = new Request(
      `http://localhost/api/shifts/${shiftId}/rsvps`,
      {
        method: "DELETE",
        headers,
      },
    );

    const response = await DELETE_RSVP(request, {
      params: Promise.resolve({ shiftId }),
    });
    expect(response.status).toBe(200);

    const rsvp = await db
      .select()
      .from(shiftRSVPs)
      .where(
        and(eq(shiftRSVPs.shiftId, shiftId), eq(shiftRSVPs.userId, user.id)),
      );

    expect(rsvp.length).toBe(0);
  });

  it("returns 403 if userId is specified but user lacks permissions", async () => {
    const theUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    await addMember(user.id, organization.id, "member");
    await setActiveOrganization(session.id, organization.id);
    const shiftId = await createShift(organization.id, { name: "Test Shift" });
    await createShiftRSVP(shiftId, user.id);

    const request = new Request(
      `http://localhost/api/shifts/${shiftId}/rsvps?userId=${user.id}`,
      {
        method: "DELETE",
        headers,
      },
    );

    const response = await DELETE_RSVP(request, {
      params: Promise.resolve({ shiftId }),
    });
    expect(response.status).toBe(403);
  });

  it("deletes RSVP for specified user", async () => {
    const theUser = await buildTestUser();
    const anotherUser = await buildTestUser();
    const organization = await createOrganization("acme");
    const { user, session, headers } = await signUpAndGetSession(theUser);
    const { user: user2 } = await signUpAndGetSession(anotherUser);
    await addMember(user.id, organization.id, "admin");
    await addMember(user2.id, organization.id, "admin");
    await setActiveOrganization(session.id, organization.id);
    const shiftId = await createShift(organization.id, { name: "Test Shift" });
    await createShiftRSVP(shiftId, user.id);
    await createShiftRSVP(shiftId, user2.id);

    const request = new Request(
      `http://localhost/api/shifts/${shiftId}/rsvps?userId=${user2.id}`,
      {
        method: "DELETE",
        headers,
      },
    );

    const response = await DELETE_RSVP(request, {
      params: Promise.resolve({ shiftId }),
    });
    expect(response.status).toBe(200);

    const rsvp = await db
      .select()
      .from(shiftRSVPs)
      .where(
        and(eq(shiftRSVPs.shiftId, shiftId), eq(shiftRSVPs.userId, user2.id)),
      );

    expect(rsvp.length).toBe(0);
  });
});
