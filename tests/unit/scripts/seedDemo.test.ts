// @vitest-environment node

import { eq, inArray } from "drizzle-orm";
import { expect, it, vi } from "vitest";
import db from "@/lib/db";
import { events, OrganizationConfigKey } from "@/lib/schema";
import { seedDemo } from "@/scripts/seedDemo";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";

it("refreshes the demo dates without duplicating events or changing existing events", async () => {
  const firstDate = new Date("2026-10-05T12:00:00Z");
  await seedDemo(firstDate);
  const [original] = await db
    .select()
    .from(events)
    .where(eq(events.id, "event_003"));
  const laterDate = new Date("2027-01-01T12:00:00Z");
  await seedDemo(laterDate);
  const demoEvents = await db
    .select()
    .from(events)
    .where(inArray(events.id, ["demo_event_published", "demo_event_draft"]));
  expect(demoEvents).toHaveLength(2);
  expect(
    await OrganizationConfigService.getConfig("org_horizontal_center", [
      OrganizationConfigKey.LogoUrl,
      OrganizationConfigKey.Tagline,
    ]),
  ).toEqual({
    [OrganizationConfigKey.LogoUrl]: "/bog.svg",
    [OrganizationConfigKey.Tagline]: "Together we serve our community.",
  });
  for (const event of demoEvents) {
    expect(event.startTimestamp!.getTime()).toBeGreaterThan(
      laterDate.getTime(),
    );
    expect(event.rsvpDeadline!.getTime()).toBeGreaterThan(laterDate.getTime());
    expect(event.rsvpDeadline!.getTime()).toBeLessThan(
      event.startTimestamp!.getTime(),
    );
  }
  expect(
    demoEvents.find((event) => event.id === "demo_event_published")!
      .publishedById,
  ).toBeTruthy();
  expect(
    demoEvents.find((event) => event.id === "demo_event_draft")!.publishedAt,
  ).toBeNull();
  expect(
    await db.select().from(events).where(eq(events.id, original.id)),
  ).toEqual([original]);
});

it("refuses to seed a remote database", async () => {
  vi.stubEnv("DB_URL", "postgres://dev:root@production.example.com/postgres");
  try {
    await expect(seedDemo()).rejects.toThrow("requires a local DB_URL");
  } finally {
    vi.unstubAllEnvs();
  }
});
