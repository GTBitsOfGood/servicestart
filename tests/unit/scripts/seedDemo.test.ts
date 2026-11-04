// @vitest-environment node

import { and, eq, inArray } from "drizzle-orm";
import { expect, it, vi } from "vitest";
import db from "@/lib/db";
import {
  events,
  forms,
  FormStatus,
  OrganizationConfigKey,
  users,
} from "@/lib/schema";
import { DEMO_FORM, seedDemo } from "@/scripts/seedDemo";
import { FormSubmissionService } from "@/lib/services/FormSubmissionService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { createFormSubmission } from "@/tests/unit/testUtils";

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

it("recreates the ServiceStart demo form, undoing a rehearsal", async () => {
  await seedDemo();
  const [member] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.organizationId, "org_servicestart"),
        eq(users.email, "member1@example.com"),
      ),
    );
  await createFormSubmission(
    { id: DEMO_FORM.id, organizationId: "org_servicestart" },
    { userId: member.id },
  );
  await db
    .update(forms)
    .set({ status: FormStatus.Closed, title: "Renamed" })
    .where(eq(forms.id, DEMO_FORM.id));

  await seedDemo();

  expect(
    await FormSubmissionService.getPublishedDefinition(
      "org_servicestart",
      DEMO_FORM.formId,
    ),
  ).toEqual(DEMO_FORM);
  expect(
    await FormSubmissionService.isMemberSubmissionEditable({
      form: DEMO_FORM,
      organizationId: "org_servicestart",
      userId: member.id,
    }),
  ).toBeNull();
  expect(
    await OrganizationConfigService.getConfig("org_servicestart", [
      OrganizationConfigKey.FormsEnabled,
    ]),
  ).toEqual({ [OrganizationConfigKey.FormsEnabled]: true });
  expect(
    await FormSubmissionService.getDefinition(
      "org_horizontal_center",
      DEMO_FORM.formId,
    ),
  ).toBeNull();
});

it("refuses to seed a remote database", async () => {
  vi.stubEnv("DB_URL", "postgres://dev:root@production.example.com/postgres");
  try {
    await expect(seedDemo()).rejects.toThrow("requires a local DB_URL");
  } finally {
    vi.unstubAllEnvs();
  }
});
