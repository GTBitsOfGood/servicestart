// @vitest-environment node
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDbUrl } from "@/core/utils/env";

/*
 * The Sprint 5 member types migration (#333), run on a database that has
 * Sprint 4's schema and data: a generated migration (the new tables and the
 * text columns), the hand-written backfill, then a generated one (the foreign
 * key and dropping the enum).
 */

const MIGRATIONS = path.resolve("drizzle");
// The first Sprint 5 migration. Everything before it is Sprint 4's schema.
const FIRST_SPRINT_5 = "20261106183003_member_types_and_drafts";

const dbName = `migtest_${randomUUID().split("-")[0]}`;
let sprint4Folder: string;
let client: ReturnType<typeof drizzle>;

const LAYOUT = (widget: string) =>
  JSON.stringify({
    layout: "horizontal",
    widgets: [{ id: widget, size: "tall" }],
  });

async function query<T = Record<string, unknown>>(text: string) {
  const result = await client.$client.query(text);
  return result.rows as T[];
}

beforeAll(async () => {
  execSync(`psql ${getDbUrl("postgres")} -c "CREATE DATABASE ${dbName};"`, {
    stdio: "ignore",
  });
  client = drizzle(getDbUrl(dbName));

  // Sprint 4's migrations only.
  sprint4Folder = fs.mkdtempSync(path.join(os.tmpdir(), "sprint4-"));
  for (const name of fs.readdirSync(MIGRATIONS)) {
    if (name < FIRST_SPRINT_5) {
      fs.cpSync(path.join(MIGRATIONS, name), path.join(sprint4Folder, name), {
        recursive: true,
      });
    }
  }
  await migrate(client, { migrationsFolder: sprint4Folder });

  // A camp with member types on, typed members, and both layout keys set;
  // an org with a typed member but member types off; an org with neither;
  // and an org whose applicant layout isn't valid JSON.
  await query(`
    INSERT INTO organizations (id, name, slug) VALUES
      ('org_camp', 'Camp', 'camp'),
      ('org_typed', 'Typed', 'typed'),
      ('org_plain', 'Plain', 'plain'),
      ('org_broken', 'Broken', 'broken');
    INSERT INTO users (id, name, email, organization_id) VALUES
      ('u_admin', 'Admin', 'admin@example.com', 'org_camp'),
      ('u_applicant', 'Applicant', 'applicant@example.com', 'org_camp'),
      ('u_attendee', 'Attendee', 'attendee@example.com', 'org_camp'),
      ('u_untyped', 'Untyped', 'untyped@example.com', 'org_camp'),
      ('u_typed', 'Typed', 'typed@example.com', 'org_typed'),
      ('u_plain', 'Plain', 'plain@example.com', 'org_plain');
    INSERT INTO members (id, user_id, organization_id, role, member_type) VALUES
      ('m_admin', 'u_admin', 'org_camp', 'admin', NULL),
      ('m_applicant', 'u_applicant', 'org_camp', 'member', 'applicant'),
      ('m_attendee', 'u_attendee', 'org_camp', 'member', 'attendee'),
      ('m_untyped', 'u_untyped', 'org_camp', 'member', NULL),
      ('m_typed', 'u_typed', 'org_typed', 'member', 'attendee'),
      ('m_plain', 'u_plain', 'org_plain', 'member', NULL);
    INSERT INTO organization_config (id, organization_id, key, value) VALUES
      ('c1', 'org_camp', 'member_types_enabled', 'true'),
      ('c2', 'org_camp', 'applicant_dashboard_layout', '${LAYOUT("application_status")}'),
      ('c3', 'org_camp', 'attendee_dashboard_layout', '${LAYOUT("forms_todo")}'),
      ('c4', 'org_camp', 'dashboard_layout', '${LAYOUT("events")}'),
      ('c5', 'org_broken', 'member_types_enabled', 'true'),
      ('c6', 'org_broken', 'applicant_dashboard_layout', '{not json'),
      ('c7', 'org_broken', 'attendee_dashboard_layout', '${LAYOUT("newsletter")}');
  `);

  await migrate(client, { migrationsFolder: MIGRATIONS });
});

afterAll(async () => {
  await client.$client.end();
  fs.rmSync(sprint4Folder, { recursive: true, force: true });
  execSync(`psql ${getDbUrl("postgres")} -c "DROP DATABASE ${dbName};"`, {
    stdio: "ignore",
  });
});

describe("Sprint 5 member types migration", () => {
  it("gives orgs with member types on, or typed members, the two types", async () => {
    const rows = await query<{
      organization_id: string;
      key: string;
      label: string;
      plural_label: string;
      position: number;
      is_signup_default: boolean;
    }>(`
      SELECT organization_id, key, label, plural_label, position, is_signup_default
      FROM member_types ORDER BY organization_id, position
    `);
    const types = (orgId: string) =>
      rows.filter((row) => row.organization_id === orgId);

    expect(types("org_camp")).toEqual([
      {
        organization_id: "org_camp",
        key: "applicant",
        label: "Applicant",
        plural_label: "Applicants",
        position: 0,
        is_signup_default: true,
      },
      {
        organization_id: "org_camp",
        key: "attendee",
        label: "Current Attendee",
        plural_label: "Current Attendees",
        position: 1,
        is_signup_default: false,
      },
    ]);
    expect(types("org_typed").map((row) => row.key)).toEqual([
      "applicant",
      "attendee",
    ]);
    expect(types("org_broken")).toHaveLength(2);
    expect(types("org_plain")).toEqual([]);
  });

  it("keeps every member's type", async () => {
    expect(
      await query(`SELECT id, member_type FROM members ORDER BY id`),
    ).toEqual([
      { id: "m_admin", member_type: null },
      { id: "m_applicant", member_type: "applicant" },
      { id: "m_attendee", member_type: "attendee" },
      { id: "m_plain", member_type: null },
      { id: "m_typed", member_type: "attendee" },
      { id: "m_untyped", member_type: null },
    ]);
  });

  it("moves the per-type layouts into member_type_dashboard_layouts", async () => {
    const rows = await query<{
      organization_id: string;
      key: string;
      value: string;
    }>(`
      SELECT organization_id, key, value FROM organization_config
      WHERE key LIKE '%dashboard_layout%' ORDER BY organization_id, key
    `);

    expect(
      rows.map(({ organization_id, key }) => [organization_id, key]),
    ).toEqual([
      ["org_broken", "member_type_dashboard_layouts"],
      ["org_camp", "dashboard_layout"],
      ["org_camp", "member_type_dashboard_layouts"],
    ]);
    const layouts = (orgId: string) =>
      JSON.parse(
        rows.find(
          (row) =>
            row.organization_id === orgId &&
            row.key === "member_type_dashboard_layouts",
        )!.value,
      );
    expect(layouts("org_camp")).toEqual({
      applicant: JSON.parse(LAYOUT("application_status")),
      attendee: JSON.parse(LAYOUT("forms_todo")),
    });
    // The unreadable applicant layout already fell back to the member layout.
    expect(layouts("org_broken")).toEqual({
      attendee: JSON.parse(LAYOUT("newsletter")),
    });
  });

  it("stores config keys as text", async () => {
    await query(`
      INSERT INTO organization_config (id, organization_id, key, value)
      VALUES ('c_new', 'org_plain', 'a_key_added_later', 'x')
    `);
    expect(
      await query(
        `SELECT data_type FROM information_schema.columns
         WHERE table_name = 'organization_config' AND column_name = 'key'`,
      ),
    ).toEqual([{ data_type: "text" }]);
  });

  it("drops the member_type and organization_config_key enums", async () => {
    expect(
      await query(
        `SELECT typname FROM pg_type
         WHERE typname IN ('member_type', 'organization_config_key')`,
      ),
    ).toEqual([]);
  });

  it("rejects a member type from another organization", async () => {
    await query(`
      INSERT INTO member_types (organization_id, key, label, plural_label, position)
      VALUES ('org_camp', 'volunteer', 'Volunteer', 'Volunteers', 2)
    `);
    // org_typed has applicant and attendee, but not org_camp's volunteer.
    await expect(
      query(
        `UPDATE members SET member_type = 'volunteer' WHERE id = 'm_typed'`,
      ),
    ).rejects.toThrow(/members_member_type_fkey/);
    await expect(
      query(
        `UPDATE members SET member_type = 'volunteer' WHERE id = 'm_plain'`,
      ),
    ).rejects.toThrow(/members_member_type_fkey/);
    await query(
      `UPDATE members SET member_type = 'volunteer' WHERE id = 'm_untyped'`,
    );
  });

  it("allows only one signup default per organization", async () => {
    await expect(
      query(`UPDATE member_types SET is_signup_default = true
             WHERE organization_id = 'org_camp' AND key = 'attendee'`),
    ).rejects.toThrow(/member_types_one_signup_default_idx/);
  });

  it("still deletes an organization along with its members and types", async () => {
    await query(`DELETE FROM organizations WHERE id = 'org_camp'`);
    expect(
      await query(`SELECT id FROM members WHERE organization_id = 'org_camp'`),
    ).toEqual([]);
    expect(
      await query(
        `SELECT id FROM member_types WHERE organization_id = 'org_camp'`,
      ),
    ).toEqual([]);
  });
});
