// @vitest-environment node
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import db from "@/core/db";
import { organizationConfig, OrganizationConfigKey } from "@/core/db/schema";
import {
  ConfigValidationError,
  encodeConfigValue,
} from "@/core/config/defineConfig";
import { getConfigDefinition } from "@/core/config/registry";
import { configStore } from "@/core/config/store";
import { CONFIG_SAMPLES } from "@/tests/unit/core/config/configSamples";
import { createOrganization } from "@/tests/unit/testUtils";

const ALL_KEYS = Object.values(OrganizationConfigKey);

async function storedRows(organizationId: string, key: OrganizationConfigKey) {
  const rows = await db
    .select({ value: organizationConfig.value })
    .from(organizationConfig)
    .where(
      and(
        eq(organizationConfig.organizationId, organizationId),
        eq(organizationConfig.key, key),
      ),
    );
  return rows.map((row) => row.value);
}

async function insertRow(
  organizationId: string,
  key: OrganizationConfigKey,
  value: string,
) {
  await db
    .insert(organizationConfig)
    .values({ id: randomUUID(), organizationId, key, value });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(ALL_KEYS)("config store: %s", (key) => {
  const definition = getConfigDefinition(key);
  const sample = CONFIG_SAMPLES[key];
  const slug = (suffix: string) =>
    `store-${key.replaceAll("_", "-")}-${suffix}`.slice(0, 60);

  it("returns the default when there's no row", async () => {
    const org = await createOrganization(slug("missing"));
    expect(await configStore.get(org.id, [key])).toEqual({
      [key]: definition.default,
    });
  });

  it("returns the default, and warns, when the stored row is invalid", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const org = await createOrganization(slug("invalid-row"));
    await insertRow(org.id, key, encodeConfigValue(sample.invalid));

    expect(await configStore.get(org.id, [key])).toEqual({
      [key]: definition.default,
    });
    expect(await configStore.getExplicit(org.id, [key])).toEqual({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(key));
  });

  it("round-trips a valid value, stored in today's format", async () => {
    const org = await createOrganization(slug("valid"));

    await configStore.set(org.id, key, sample.valid);
    expect(await storedRows(org.id, key)).toEqual([sample.stored]);
    expect(await configStore.getOne(org.id, key)).toEqual(sample.valid);

    // Writing again updates the row instead of adding one.
    await configStore.set(org.id, key, sample.stored);
    expect(await storedRows(org.id, key)).toEqual([sample.stored]);
  });

  it("reads a row written before the registry", async () => {
    const org = await createOrganization(slug("legacy"));
    await insertRow(org.id, key, sample.stored);

    expect(await configStore.getOne(org.id, key)).toEqual(sample.valid);
  });

  it("rejects an invalid write with a useful message and keeps the row", async () => {
    const org = await createOrganization(slug("reject"));
    await configStore.set(org.id, key, sample.valid);

    const write = configStore.set(org.id, key, sample.invalid);
    await expect(write).rejects.toBeInstanceOf(ConfigValidationError);
    await expect(configStore.set(org.id, key, sample.invalid)).rejects.toThrow(
      sample.message,
    );
    expect(await storedRows(org.id, key)).toEqual([sample.stored]);
  });
});

describe("config store", () => {
  it("reads several keys at once, each with its own type", async () => {
    const org = await createOrganization("store-many");
    await configStore.set(org.id, OrganizationConfigKey.FormsEnabled, "true");
    await configStore.set(org.id, OrganizationConfigKey.Tagline, "Hi");

    const values = await configStore.get(org.id, [
      OrganizationConfigKey.FormsEnabled,
      OrganizationConfigKey.Tagline,
      OrganizationConfigKey.MembersPageEnabled,
    ]);

    const formsEnabled: boolean = values[OrganizationConfigKey.FormsEnabled];
    expect(formsEnabled).toBe(true);
    expect(values).toEqual({
      forms_enabled: true,
      tagline: "Hi",
      members_page_enabled: true,
    });
  });

  it("keeps one org's values away from another's", async () => {
    const orgA = await createOrganization("store-iso-a");
    const orgB = await createOrganization("store-iso-b");
    await configStore.set(orgA.id, OrganizationConfigKey.FormsEnabled, true);

    expect(
      await configStore.getOne(orgB.id, OrganizationConfigKey.FormsEnabled),
    ).toBe(false);
    expect(
      await configStore.getExplicit(orgB.id, [
        OrganizationConfigKey.FormsEnabled,
      ]),
    ).toEqual({});
  });

  it("skips keys that aren't config keys", async () => {
    const org = await createOrganization("store-unknown");
    expect(
      await configStore.get(org.id, ["constructor" as OrganizationConfigKey]),
    ).toEqual({});
    await expect(
      configStore.set(org.id, "constructor" as OrganizationConfigKey, "x"),
    ).rejects.toThrow("Invalid key");
  });

  it("returns only set keys from getExplicit", async () => {
    const org = await createOrganization("store-explicit");
    await configStore.set(
      org.id,
      OrganizationConfigKey.PrimaryColor,
      "#000000",
    );

    expect(
      await configStore.getExplicit(org.id, [
        OrganizationConfigKey.PrimaryColor,
        OrganizationConfigKey.SecondaryColor,
      ]),
    ).toEqual({ primary_color: "#000000" });
  });

  it.each([
    OrganizationConfigKey.MobileNavbarShowIcons,
    OrganizationConfigKey.MobileNavbarProfileOrientation,
  ])("%s: 'inherit' and null delete the row", async (key) => {
    const org = await createOrganization(`store-inherit-${key.length}`);
    const sample = CONFIG_SAMPLES[key];

    await configStore.set(org.id, key, sample.valid);
    await configStore.set(org.id, key, "inherit");
    expect(await storedRows(org.id, key)).toEqual([]);
    expect(await configStore.getOne(org.id, key)).toBeNull();

    await configStore.set(org.id, key, sample.valid);
    await configStore.set(org.id, key, null);
    expect(await storedRows(org.id, key)).toEqual([]);
  });

  it("clear sends a key back to its default", async () => {
    const org = await createOrganization("store-clear");
    await configStore.set(
      org.id,
      OrganizationConfigKey.MembersPageEnabled,
      false,
    );
    await configStore.clear(org.id, OrganizationConfigKey.MembersPageEnabled);

    expect(
      await configStore.getOne(
        org.id,
        OrganizationConfigKey.MembersPageEnabled,
      ),
    ).toBe(true);
  });
});
