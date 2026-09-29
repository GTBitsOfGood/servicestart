// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import db from "@/lib/db";
import { shifts, shiftRSVPs, events } from "@/lib/schema";
import { app } from "@/lib/app";
import {
  addMember,
  buildTestUser,
  createOrganization,
  createEvent,
  createShift,
  createShiftRSVP,
  setActiveOrganization,
  signUpAndGetSession,
  testApi,
} from "@/tests/unit/testUtils";

async function actor(organizationId: string, role: string | null = "member") {
  const result = await signUpAndGetSession(buildTestUser());
  if (role) await addMember(result.user.id, organizationId, role);
  await setActiveOrganization(result.session.id, organizationId);
  return result;
}

async function setup(role: string | null = "admin") {
  const organization = await createOrganization(`shifts-${randomUUID()}`);
  const user = await actor(organization.id, role);
  const eventId = await createEvent(organization.id);
  const shiftId = await createShift(organization.id, { eventId });
  return { organization, eventId, shiftId, ...user };
}

const shiftData = (eventId: string) => ({
  eventId,
  name: "Welcome desk",
  description: "Greet volunteers",
  startTimestamp: "2030-06-01T10:00:00Z",
  duration: "2 hours",
});

describe("shift management", () => {
  it.each(["admin", "owner"])(
    "lets %s create, read, update, reassign and delete",
    async (role) => {
      const { headers, organization, eventId, user } = await setup(role);
      const created = await testApi.shifts.$post(
        { json: shiftData(eventId) },
        { headers },
      );
      expect(created.status).toBe(200);
      const body = await created.json();
      if (!("shift" in body)) throw new Error("Expected shift");
      expect(body.shift.rsvpLimit).toBeNull();
      const param = { shiftId: body.shift.id };
      const read = await testApi.shifts[":shiftId"].$get(
        { param },
        { headers },
      );
      expect(read.status).toBe(200);
      const otherEvent = await createEvent(organization.id);
      const updated = await testApi.shifts[":shiftId"].$patch(
        {
          param,
          json: {
            name: "Updated",
            eventId: otherEvent,
            rsvpLimit: 3,
          },
        },
        { headers },
      );
      expect(updated.status).toBe(200);
      await createShiftRSVP(param.shiftId, user.id);
      const unlimited = await testApi.shifts[":shiftId"].$patch(
        { param, json: { rsvpLimit: null } },
        { headers },
      );
      expect(unlimited.status).toBe(200);
      const rows = await db
        .select()
        .from(shifts)
        .where(eq(shifts.id, param.shiftId));
      expect(rows[0]).toMatchObject({
        name: "Updated",
        eventId: otherEvent,
        organizationId: organization.id,
        rsvpLimit: null,
      });
      expect(
        (await testApi.shifts[":shiftId"].$delete({ param }, { headers }))
          .status,
      ).toBe(200);
      expect(
        await db
          .select()
          .from(shiftRSVPs)
          .where(eq(shiftRSVPs.shiftId, param.shiftId)),
      ).toHaveLength(0);
      expect(
        (await testApi.shifts[":shiftId"].$get({ param }, { headers })).status,
      ).toBe(404);
    },
  );

  it.each([null, "member"])("rejects management by role %s", async (role) => {
    const { headers, eventId, shiftId } = await setup(role);
    expect(
      (await testApi.shifts.$post({ json: shiftData(eventId) }, { headers }))
        .status,
    ).toBe(403);
    expect(
      (
        await testApi.shifts[":shiftId"].$patch(
          { param: { shiftId }, json: { name: "No" } },
          { headers },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await testApi.shifts[":shiftId"].$delete(
          { param: { shiftId } },
          { headers },
        )
      ).status,
    ).toBe(403);
  });

  it("rejects unauthenticated operations", async () => {
    const param = { shiftId: "missing" };
    const responses = await Promise.all([
      testApi.shifts.$post({ json: shiftData("missing") }),
      testApi.shifts[":shiftId"].$get({ param }),
      testApi.shifts[":shiftId"].$patch({ param, json: { name: "No" } }),
      testApi.shifts[":shiftId"].$delete({ param }),
      testApi.shifts[":shiftId"].rsvps.$post({ param, query: {} }),
      testApi.shifts[":shiftId"].rsvps.$delete({ param, query: {} }),
    ]);
    expect(responses.map((r) => r.status)).toEqual([
      401, 401, 401, 401, 401, 401,
    ]);
  });

  it("returns 404 for nonexistent resources", async () => {
    const { headers } = await setup();
    const param = { shiftId: "missing" };
    const responses = await Promise.all([
      testApi.shifts.$post({ json: shiftData("missing") }, { headers }),
      testApi.shifts[":shiftId"].$get({ param }, { headers }),
      testApi.shifts[":shiftId"].$patch(
        { param, json: { name: "No" } },
        { headers },
      ),
      testApi.shifts[":shiftId"].$delete({ param }, { headers }),
      testApi.shifts[":shiftId"].rsvps.$post({ param, query: {} }, { headers }),
      testApi.shifts[":shiftId"].rsvps.$delete(
        { param, query: {} },
        { headers },
      ),
    ]);
    expect(responses.map((r) => r.status)).toEqual([
      404, 404, 404, 404, 404, 404,
    ]);
  });

  it.each([
    { startTimestamp: "invalid" },
    { duration: "" },
    { duration: "0 hours" },
    { duration: "-1 hours" },
    { duration: "2 hours junk" },
    { duration: "01:90:00" },
    { rsvpLimit: 0 },
    { rsvpLimit: -1 },
    { rsvpLimit: 1.5 },
    { rsvpLimit: 2_147_483_648 },
  ])("rejects invalid create and update fields: %j", async (invalid) => {
    const { headers, eventId, shiftId } = await setup();
    expect(
      (
        await testApi.shifts.$post(
          { json: { ...shiftData(eventId), ...invalid } },
          { headers },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await testApi.shifts[":shiftId"].$patch(
          { param: { shiftId }, json: invalid },
          { headers },
        )
      ).status,
    ).toBe(400);
  });

  it("requires scheduling fields and rejects malformed JSON and empty patches", async () => {
    const { headers, shiftId, eventId } = await setup();
    for (const body of ["{", JSON.stringify({ eventId })]) {
      const response = await app.request("/api/shifts", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body,
      });
      expect(response.status).toBe(400);
    }
    expect(
      (
        await testApi.shifts[":shiftId"].$patch(
          { param: { shiftId }, json: {} },
          { headers },
        )
      ).status,
    ).toBe(400);
  });
});

describe("tenant and parent-event access", () => {
  it("an org A admin cannot reach or mutate org B shifts, including patches without eventId", async () => {
    const a = await setup();
    const b = await setup();
    await createShiftRSVP(b.shiftId, b.user.id);
    const param = { shiftId: b.shiftId };
    const opts = { headers: a.headers };
    const responses = await Promise.all([
      testApi.shifts.$post({ json: shiftData(b.eventId) }, opts),
      testApi.shifts[":shiftId"].$get({ param }, opts),
      testApi.shifts[":shiftId"].$patch(
        { param, json: { name: "Stolen" } },
        opts,
      ),
      testApi.shifts[":shiftId"].$patch(
        { param, json: { eventId: a.eventId } },
        opts,
      ),
      testApi.shifts[":shiftId"].$delete({ param }, opts),
      testApi.shifts[":shiftId"].rsvps.$post({ param, query: {} }, opts),
      testApi.shifts[":shiftId"].rsvps.$delete(
        { param, query: { userId: b.user.id } },
        opts,
      ),
      testApi.events[":eventId"].shifts.$get(
        { param: { eventId: b.eventId }, query: {} },
        opts,
      ),
      testApi.shifts[":shiftId"].$patch(
        { param: { shiftId: a.shiftId }, json: { eventId: b.eventId } },
        opts,
      ),
    ]);
    expect(responses.every((r) => r.status === 404)).toBe(true);
    expect(
      (await db.select().from(shifts).where(eq(shifts.id, b.shiftId)))[0],
    ).toMatchObject({
      name: "Test Shift",
      eventId: b.eventId,
      organizationId: b.organization.id,
    });
    expect(
      await db
        .select()
        .from(shiftRSVPs)
        .where(eq(shiftRSVPs.shiftId, b.shiftId)),
    ).toEqual([{ shiftId: b.shiftId, userId: b.user.id }]);
  });

  it("requires membership even for public parent events", async () => {
    const { headers, shiftId, eventId } = await setup(null);
    const param = { shiftId };
    const responses = await Promise.all([
      testApi.shifts[":shiftId"].$get({ param }, { headers }),
      testApi.shifts[":shiftId"].rsvps.$post({ param, query: {} }, { headers }),
      testApi.shifts[":shiftId"].rsvps.$delete(
        { param, query: {} },
        { headers },
      ),
      testApi.events[":eventId"].shifts.$get(
        { param: { eventId }, query: {} },
        { headers },
      ),
    ]);
    expect(responses.map((r) => r.status)).toEqual([403, 403, 403, 403]);
  });

  it("hides drafts from members while allowing admin management but no signup", async () => {
    const admin = await setup();
    const member = await actor(admin.organization.id);
    await db
      .update(events)
      .set({ publishedAt: null })
      .where(eq(events.id, admin.eventId));
    const param = { shiftId: admin.shiftId };
    for (const current of [admin, member]) {
      const expected = current === admin ? 200 : 404;
      expect(
        (
          await testApi.shifts[":shiftId"].$get(
            { param },
            { headers: current.headers },
          )
        ).status,
      ).toBe(expected);
      expect(
        (
          await testApi.events[":eventId"].shifts.$get(
            { param: { eventId: admin.eventId }, query: {} },
            { headers: current.headers },
          )
        ).status,
      ).toBe(expected);
      expect(
        (
          await testApi.shifts[":shiftId"].rsvps.$post(
            { param, query: {} },
            { headers: current.headers },
          )
        ).status,
      ).toBe(current === admin ? 400 : 404);
    }
    expect(
      (
        await testApi.shifts[":shiftId"].$patch(
          { param, json: { name: "Draft shift" } },
          { headers: admin.headers },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await testApi.shifts.$post(
          { json: shiftData(admin.eventId) },
          { headers: admin.headers },
        )
      ).status,
    ).toBe(200);
  });
});

describe("shift RSVP authorization and constraints", () => {
  it("lets a member join two shifts, retry, explicitly target self, and withdraw twice", async () => {
    const { headers, user, organization, shiftId } = await setup("member");
    const second = await createShift(organization.id);
    for (const id of [shiftId, shiftId, second]) {
      expect(
        (
          await testApi.shifts[":shiftId"].rsvps.$post(
            { param: { shiftId: id }, query: { userId: user.id } },
            { headers },
          )
        ).status,
      ).toBe(200);
    }
    expect(
      await db.select().from(shiftRSVPs).where(eq(shiftRSVPs.userId, user.id)),
    ).toHaveLength(2);
    for (let i = 0; i < 2; i++) {
      expect(
        (
          await testApi.shifts[":shiftId"].rsvps.$delete(
            { param: { shiftId }, query: { userId: user.id } },
            { headers },
          )
        ).status,
      ).toBe(200);
    }
    expect(
      await db.select().from(shiftRSVPs).where(eq(shiftRSVPs.userId, user.id)),
    ).toEqual([{ shiftId: second, userId: user.id }]);
  });

  it.each(["admin", "owner"])(
    "allows %s to register/remove a member; rejects the reverse",
    async (role) => {
      const admin = await setup(role);
      const member = await actor(admin.organization.id);
      const param = { shiftId: admin.shiftId };
      for (const method of ["$post", "$delete"] as const) {
        const rejected = await testApi.shifts[":shiftId"].rsvps[method](
          { param, query: { userId: admin.user.id } },
          { headers: member.headers },
        );
        expect(rejected.status).toBe(403);
        const allowed = await testApi.shifts[":shiftId"].rsvps[method](
          { param, query: { userId: member.user.id } },
          { headers: admin.headers },
        );
        expect(allowed.status).toBe(200);
      }
    },
  );

  it("rejects nonmember and foreign-org targets for signup and withdrawal", async () => {
    const admin = await setup();
    const other = await setup();
    for (const userId of [other.user.id, "missing"]) {
      for (const method of ["$post", "$delete"] as const) {
        expect(
          (
            await testApi.shifts[":shiftId"].rsvps[method](
              { param: { shiftId: admin.shiftId }, query: { userId } },
              { headers: admin.headers },
            )
          ).status,
        ).toBe(404);
      }
    }
  });

  it("returns a clear full response and prevents lowering capacity below attendance", async () => {
    const admin = await setup();
    const member = await actor(admin.organization.id);
    const param = { shiftId: admin.shiftId };
    await createShiftRSVP(admin.shiftId, admin.user.id);
    await createShiftRSVP(admin.shiftId, member.user.id);
    expect(
      (
        await testApi.shifts[":shiftId"].$patch(
          { param, json: { rsvpLimit: 1 } },
          { headers: admin.headers },
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await testApi.shifts[":shiftId"].$patch(
          { param, json: { rsvpLimit: 2 } },
          { headers: admin.headers },
        )
      ).status,
    ).toBe(200);
    const third = await actor(admin.organization.id);
    const response = await testApi.shifts[":shiftId"].rsvps.$post(
      { param, query: {} },
      { headers: third.headers },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ reason: "full" });
  });

  it("closes signup and withdrawal after the parent deadline even for admins", async () => {
    const admin = await setup();
    const param = { shiftId: admin.shiftId };
    await db
      .update(events)
      .set({ rsvpDeadline: new Date(0) })
      .where(eq(events.id, admin.eventId));
    for (const method of ["$post", "$delete"] as const) {
      const response = await testApi.shifts[":shiftId"].rsvps[method](
        { param, query: {} },
        { headers: admin.headers },
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        reason: "deadline-passed",
      });
    }
  });
});
