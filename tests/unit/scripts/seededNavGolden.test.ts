// @vitest-environment node

/*
 * Golden fixtures for #337: the navbar and the dashboard widget options of
 * every seeded org, recorded before the feature manifests replaced the shared
 * nav and widget lists. The snapshot must not change; never update it with
 * `-u`. A diff here means a visible change to some org's navbar or widgets.
 */
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db from "@/core/db";
import {
  members,
  organizationConfig,
  organizations,
  OrganizationConfigKey,
  users,
} from "@/core/db/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import {
  decodeConfigValue,
  type ConfigDefinition,
} from "@/core/config/defineConfig";
import { getConfigDefinition } from "@/core/config/registry";
import { getWidgetOptions } from "@/features/dashboard/widgets";
import getNavbarItems from "@/features/navigation/getNavbarItems";
import { main } from "@/scripts/seed";

type Session = Parameters<typeof getNavbarItems>[0];
type Nav = Awaited<ReturnType<typeof getNavbarItems>>;

const view = (items: Nav) =>
  items.map(({ href, label, subpages }) => ({
    href,
    label,
    subpages: subpages?.map((page) => ({ href: page.href, label: page.label })),
  }));

let orgs: { id: string; slug: string }[] = [];

// tests/unit/setup.ts empties the database before each test, so seed in each.
beforeEach(async () => {
  await main();
  orgs = await db
    .select({ id: organizations.id, slug: organizations.slug })
    .from(organizations)
    .orderBy(asc(organizations.slug));
});

describe("seeded org golden fixtures", () => {
  it("seeds every org the fixtures cover", () => {
    expect(orgs.map((org) => org.slug)).toEqual([
      "applicationstart",
      "horizontal-center",
      "horizontal-left",
      "servicestart",
      "vertical-icon",
      "visionariestothethrone",
      "volunteerstart",
    ]);
  });

  it("keeps every org's navbar for every member and for visitors", async () => {
    const navs: Record<string, ReturnType<typeof view>> = {};
    for (const org of orgs) {
      navs[`${org.slug} | signed out`] = view(
        await getNavbarItems(null, org.id),
      );
      const rows = await db
        .select({
          id: users.id,
          email: users.email,
          role: members.role,
          memberType: members.memberType,
        })
        .from(members)
        .innerJoin(users, eq(users.id, members.userId))
        .where(eq(members.organizationId, org.id))
        .orderBy(asc(users.email));
      for (const row of rows) {
        const session = {
          user: { id: row.id },
          session: {},
        } as unknown as Session;
        const who = `${row.email} (${row.role}${row.memberType ? `/${row.memberType}` : ""})`;
        navs[`${org.slug} | ${who}`] = view(
          await getNavbarItems(session, org.id),
        );
      }
    }
    expect(navs).toMatchSnapshot();
  });

  it("keeps every org's widget options with forms on and off", async () => {
    const options: Record<string, ReturnType<typeof getWidgetOptions>> = {};
    for (const org of orgs) {
      const stored = await OrganizationConfigService.getConfig(org.id, [
        OrganizationConfigKey.FormsEnabled,
      ]);
      options[`${org.slug} | stored`] = getWidgetOptions(stored);
      for (const enabled of [true, false]) {
        options[`${org.slug} | forms ${enabled ? "on" : "off"}`] =
          getWidgetOptions({
            ...stored,
            [OrganizationConfigKey.FormsEnabled]: enabled,
          });
      }
    }
    expect(options).toMatchSnapshot();
  });

  it("still parses every stored navbar config and dashboard layout row", async () => {
    const keys = [
      OrganizationConfigKey.NavbarConfig,
      OrganizationConfigKey.AdminDashboardLayout,
      OrganizationConfigKey.DashboardLayout,
      OrganizationConfigKey.MemberTypeDashboardLayouts,
    ];
    const rows = await db.select().from(organizationConfig);
    const relevant = rows.filter((row) => keys.includes(row.key));
    expect(relevant.length).toBeGreaterThan(0);
    for (const row of relevant) {
      const definition = getConfigDefinition(row.key) as ConfigDefinition;
      const result = decodeConfigValue(definition, row.value);
      expect(result.success, `${row.organizationId} ${row.key}`).toBe(true);
    }
  });
});
