import "dotenv/config";
import { and, eq } from "drizzle-orm";
import db, { getDbUrl } from "@/lib/db";
import {
  EventVisibility,
  events,
  users,
  OrganizationConfigKey,
} from "@/lib/schema";
import { main as seed } from "./seed";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";

/** Refresh only the dedicated demo fixtures; retain accounts and other events. */
export async function seedDemo(now = new Date()) {
  const url = new URL(getDbUrl());
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error(
      "Demo seeding requires a local DB_URL; never use production.",
    );
  }
  await seed();
  await OrganizationConfigService.setConfig(
    "org_horizontal_center",
    OrganizationConfigKey.LogoUrl,
    "/bog.svg",
  );
  await OrganizationConfigService.setConfig(
    "org_horizontal_center",
    OrganizationConfigKey.Tagline,
    "Together we serve our community.",
  );
  await OrganizationConfigService.setConfig(
    "org_horizontal_center",
    OrganizationConfigKey.PrimaryColor,
    "#5C218C",
  );
  await OrganizationConfigService.setConfig(
    "org_horizontal_center",
    OrganizationConfigKey.SecondaryColor,
    "#C29BDC",
  );
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.organizationId, "org_servicestart"),
        eq(users.email, "admin@example.com"),
      ),
    );
  if (!admin) throw new Error("Seeded administrator is missing.");

  for (let index = 0; index < 2; index++) {
    const published = index === 0;
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() + 14 + index * 7);
    start.setUTCHours(15, 0, 0, 0);
    const fixture = {
      id: `demo_event_${published ? "published" : "draft"}`,
      organizationId: "org_servicestart",
      name: published
        ? "Demo: Community park cleanup"
        : "Demo: Volunteer workshop",
      location: "123 Main St, Atlanta, GA 30332",
      description: "Help our community. Bring gloves and a water bottle.",
      startTimestamp: start,
      duration: "2 hours",
      rsvpLimit: 20,
      rsvpDeadline: new Date(start.getTime() - 86_400_000),
      visibility: EventVisibility.Public,
      publishedAt: published ? now : null,
      publishedById: published ? admin.id : null,
    };
    await db
      .insert(events)
      .values(fixture)
      .onConflictDoUpdate({ target: events.id, set: fixture });
  }
}

if (require.main === module) {
  seedDemo()
    .then(() => {
      console.log(
        "Demo ready: one upcoming published event and one editable draft.",
      );
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
