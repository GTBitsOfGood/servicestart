// @vitest-environment node
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import db from "@/lib/db";
import { events, shiftRSVPs } from "@/lib/schema";
import { ShiftService } from "@/lib/services/ShiftService";
import {
  addMember,
  buildTestUser,
  createOrganization,
  createEvent,
  createShift,
  createShiftRSVP,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";

async function member(organizationId: string, role = "member") {
  const { user } = await signUpAndGetSession(buildTestUser());
  await addMember(user.id, organizationId, role);
  return user;
}
async function setup(limit?: number) {
  const org = await createOrganization(`shift-service-${randomUUID()}`);
  const user = await member(org.id, "admin");
  const eventId = await createEvent(org.id);
  const shiftId = await createShift(org.id, { eventId, rsvpLimit: limit });
  return { org, user, eventId, shiftId };
}
const registrations = (shiftId: string) =>
  db.select().from(shiftRSVPs).where(eq(shiftRSVPs.shiftId, shiftId));

describe("ShiftService registration", () => {
  it("preserves existing registrations when applying the generated primary-key migration", async () => {
    const { org, user, shiftId } = await setup();
    const secondUser = await member(org.id);
    const secondShift = await createShift(org.id);
    const original = [
      { shiftId, userId: user.id },
      { shiftId: secondShift, userId: secondUser.id },
    ];
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "drizzle/20260925190921_powerful_cable/migration.sql",
      ),
      "utf8",
    );
    await db.transaction(async (tx) => {
      // Reconstruct the previous constraint on this isolated test database.
      await tx.execute(
        sql`ALTER TABLE shift_rsvps DROP CONSTRAINT shift_rsvps_pkey`,
      );
      await tx.execute(sql`ALTER TABLE shift_rsvps ADD PRIMARY KEY (user_id)`);
      await tx.insert(shiftRSVPs).values(original);
      for (const statement of migration.split("--> statement-breakpoint")) {
        await tx.execute(sql.raw(statement));
      }
      expect(await tx.select().from(shiftRSVPs)).toEqual(
        expect.arrayContaining(original),
      );
      await tx
        .insert(shiftRSVPs)
        .values({ shiftId: secondShift, userId: user.id });
      expect(await tx.select().from(shiftRSVPs)).toHaveLength(3);
    });
  });

  it("gives exactly one concurrent applicant the last place", async () => {
    const { org, shiftId } = await setup(1);
    const users = await Promise.all(
      Array.from({ length: 5 }, () => member(org.id)),
    );
    const results = await Promise.allSettled(
      users.map((u) => ShiftService.register(shiftId, org.id, u.id)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      results
        .filter((r) => r.status === "rejected")
        .map((r) => r.reason.reason),
    ).toEqual(Array(4).fill("full"));
    expect(await registrations(shiftId)).toHaveLength(1);
  });

  it("handles concurrent retries and keeps separate shifts independent", async () => {
    const { org, user, shiftId, eventId } = await setup(1);
    const otherShift = await createShift(org.id, { eventId, rsvpLimit: 1 });
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        ShiftService.register(shiftId, org.id, user.id),
      ),
    );
    expect(results.filter((r) => r === "added")).toHaveLength(1);
    expect(results.filter((r) => r === "already-registered")).toHaveLength(4);
    expect(await ShiftService.register(otherShift, org.id, user.id)).toBe(
      "added",
    );
    expect(await registrations(shiftId)).toHaveLength(1);
    expect(await registrations(otherShift)).toHaveLength(1);
  });

  it("enforces the composite constraint independently of service checks", async () => {
    const { org, user, shiftId } = await setup();
    const other = await createShift(org.id);
    await createShiftRSVP(shiftId, user.id);
    await createShiftRSVP(other, user.id);
    await expect(createShiftRSVP(shiftId, user.id)).rejects.toThrow();
    expect(await registrations(shiftId)).toHaveLength(1);
    expect(await registrations(other)).toHaveLength(1);
  });

  it("uses null as unlimited and preserves legacy zero as closed", async () => {
    const { org, user, shiftId } = await setup();
    const second = await member(org.id);
    await ShiftService.register(shiftId, org.id, user.id);
    await ShiftService.register(shiftId, org.id, second.id);
    expect(await registrations(shiftId)).toHaveLength(2);
    const closed = await createShift(org.id, { rsvpLimit: 0 });
    await expect(
      ShiftService.register(closed, org.id, user.id),
    ).rejects.toMatchObject({ reason: "full" });
  });

  it("uses the parent's exact deadline for signup and withdrawal, but permits signup retries", async () => {
    const { org, user, shiftId, eventId } = await setup(1);
    const deadline = new Date("2030-06-01T10:00:00Z");
    await db
      .update(events)
      .set({ rsvpDeadline: deadline })
      .where(eq(events.id, eventId));
    const before = new Date(deadline.getTime() - 1);
    await ShiftService.register(shiftId, org.id, user.id, user.id, before);
    expect(
      await ShiftService.register(shiftId, org.id, user.id, user.id, deadline),
    ).toBe("already-registered");
    await expect(
      ShiftService.withdraw(shiftId, org.id, user.id, user.id, deadline),
    ).rejects.toMatchObject({ reason: "deadline-passed" });
    const second = await member(org.id);
    await expect(
      ShiftService.register(shiftId, org.id, second.id, second.id, deadline),
    ).rejects.toMatchObject({ reason: "deadline-passed" });
    expect(
      await ShiftService.withdraw(shiftId, org.id, user.id, user.id, before),
    ).toBe("removed");
    expect(
      await ShiftService.withdraw(shiftId, org.id, user.id, user.id, before),
    ).toBe("removed");
    await expect(
      ShiftService.withdraw(shiftId, org.id, user.id, user.id, deadline),
    ).rejects.toMatchObject({ reason: "deadline-passed" });
  });

  it("checks publication before returning an existing registration", async () => {
    const { org, user, shiftId, eventId } = await setup();
    await createShiftRSVP(shiftId, user.id);
    await db
      .update(events)
      .set({ publishedAt: null })
      .where(eq(events.id, eventId));
    await expect(
      ShiftService.register(shiftId, org.id, user.id),
    ).rejects.toMatchObject({ reason: "unpublished" });
    // Admins may still clean up registrations on an unpublished event before its deadline.
    expect(await ShiftService.withdraw(shiftId, org.id, user.id)).toBe(
      "removed",
    );
  });

  it("keeps attendance within capacity when signup races a capacity reduction", async () => {
    const { org, user, shiftId } = await setup(2);
    const second = await member(org.id);
    await createShiftRSVP(shiftId, user.id);
    const results = await Promise.allSettled([
      ShiftService.register(shiftId, org.id, second.id),
      ShiftService.updateShift(shiftId, org.id, user.id, { rsvpLimit: 1 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const shift = await ShiftService.findById(shiftId, org.id, user.id);
    expect((await registrations(shiftId)).length).toBeLessThanOrEqual(
      shift!.rsvpLimit!,
    );
  });

  it("serializes signup with parent unpublishing", async () => {
    const { org, user, shiftId, eventId } = await setup();
    let signup: Promise<PromiseSettledResult<unknown>[]> | undefined;
    await db.transaction(async (tx) => {
      await tx
        .update(events)
        .set({ publishedAt: null })
        .where(eq(events.id, eventId));
      // Start while the event update is uncommitted. A signup must observe the
      // committed publication state after acquiring the parent's lock.
      signup = Promise.allSettled([
        ShiftService.register(shiftId, org.id, user.id),
      ]);
    });
    expect(await signup).toMatchObject([
      { status: "rejected", reason: { reason: "unpublished" } },
    ]);
    expect(await registrations(shiftId)).toHaveLength(0);
  });

  it("handles reassignment racing signup without losing tenant or capacity constraints", async () => {
    const { org, user, shiftId } = await setup(1);
    const replacement = await createEvent(org.id);
    const results = await Promise.allSettled([
      ShiftService.updateShift(shiftId, org.id, user.id, {
        eventId: replacement,
      }),
      ShiftService.register(shiftId, org.id, user.id),
    ]);
    expect(results[0].status).toBe("fulfilled");
    const signup = results[1];
    expect(
      signup.status === "fulfilled" ? signup.value : signup.reason.reason,
    ).toMatch(/^(added|shift-changed)$/);
    expect(await ShiftService.findById(shiftId, org.id, user.id)).toMatchObject(
      { eventId: replacement },
    );
    expect((await registrations(shiftId)).length).toBeLessThanOrEqual(1);
  });
});

describe("ShiftService tenant and permission boundaries", () => {
  it("rejects cross-organization operations directly, without relying on API guards", async () => {
    const a = await setup();
    const b = await setup();
    await createShiftRSVP(b.shiftId, b.user.id);
    expect(
      await ShiftService.findById(b.shiftId, a.org.id, a.user.id),
    ).toBeNull();
    const results = await Promise.allSettled([
      ShiftService.updateShift(b.shiftId, a.org.id, a.user.id, { name: "No" }),
      ShiftService.deleteById(b.shiftId, a.org.id, a.user.id),
      ShiftService.register(b.shiftId, a.org.id, a.user.id),
      ShiftService.withdraw(b.shiftId, a.org.id, a.user.id, b.user.id),
      ShiftService.listByEvent(
        b.eventId,
        a.org.id,
        { limit: 10, offset: 0 },
        a.user.id,
      ),
    ]);
    expect(
      results.every(
        (r) => r.status === "rejected" && r.reason.reason === "not-visible",
      ),
    ).toBe(true);
    expect(await registrations(b.shiftId)).toHaveLength(1);
    expect(
      await ShiftService.findById(b.shiftId, b.org.id, b.user.id),
    ).toMatchObject({ name: "Test Shift" });
  });

  it("rejects member-on-behalf-of-admin and nonmembers at the service boundary", async () => {
    const { org, user, shiftId } = await setup();
    const volunteer = await member(org.id);
    const { user: outsider } = await signUpAndGetSession(buildTestUser());
    for (const action of [ShiftService.register, ShiftService.withdraw]) {
      await expect(
        action(shiftId, org.id, volunteer.id, user.id),
      ).rejects.toMatchObject({ reason: "forbidden" });
      await expect(action(shiftId, org.id, outsider.id)).rejects.toMatchObject({
        reason: "forbidden",
      });
      await expect(
        action(shiftId, org.id, user.id, outsider.id),
      ).rejects.toMatchObject({ reason: "not-a-member" });
    }
  });
});
