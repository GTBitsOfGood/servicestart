// @vitest-environment node
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { organizationConfig, OrganizationConfigKey } from "@/lib/schema";
import { createOrganization } from "@/tests/unit/testUtils";
import {
  DEFAULT_ADMIN_LAYOUT,
  DEFAULT_MEMBER_LAYOUT,
} from "@/lib/dashboard/constants";
import { DEFAULT_BRANDING } from "@/lib/branding";
import { DEFAULT_APP_THEME } from "@/lib/theme";

describe("OrganizationConfigService - members_page_enabled", () => {
  describe("getConfig with MembersPageEnabled key", () => {
    it("returns 'true' by default when no config has been set", async () => {
      const org = await createOrganization("cfg-mpe-default");

      const config = await OrganizationConfigService.getConfig(org.id, [
        OrganizationConfigKey.MembersPageEnabled,
      ]);

      expect(config[OrganizationConfigKey.MembersPageEnabled]).toBe(true);
    });

    it("returns stored value after setConfig", async () => {
      const org = await createOrganization("cfg-mpe-stored");

      await OrganizationConfigService.setConfig(
        org.id,
        OrganizationConfigKey.MembersPageEnabled,
        "false",
      );

      const config = await OrganizationConfigService.getConfig(org.id, [
        OrganizationConfigKey.MembersPageEnabled,
      ]);

      expect(config[OrganizationConfigKey.MembersPageEnabled]).toBe(false);
    });
  });

  describe("setConfig with MembersPageEnabled key", () => {
    it("sets value to 'true'", async () => {
      const org = await createOrganization("cfg-mpe-set-true");

      await OrganizationConfigService.setConfig(
        org.id,
        OrganizationConfigKey.MembersPageEnabled,
        "true",
      );

      const config = await OrganizationConfigService.getConfig(org.id, [
        OrganizationConfigKey.MembersPageEnabled,
      ]);
      expect(config[OrganizationConfigKey.MembersPageEnabled]).toBe(true);
    });

    it("sets value to 'false'", async () => {
      const org = await createOrganization("cfg-mpe-set-false");

      await OrganizationConfigService.setConfig(
        org.id,
        OrganizationConfigKey.MembersPageEnabled,
        "false",
      );

      const config = await OrganizationConfigService.getConfig(org.id, [
        OrganizationConfigKey.MembersPageEnabled,
      ]);
      expect(config[OrganizationConfigKey.MembersPageEnabled]).toBe(false);
    });

    it("updates existing value (upsert)", async () => {
      const org = await createOrganization("cfg-mpe-upsert");

      await OrganizationConfigService.setConfig(
        org.id,
        OrganizationConfigKey.MembersPageEnabled,
        "false",
      );
      await OrganizationConfigService.setConfig(
        org.id,
        OrganizationConfigKey.MembersPageEnabled,
        "true",
      );

      const config = await OrganizationConfigService.getConfig(org.id, [
        OrganizationConfigKey.MembersPageEnabled,
      ]);
      expect(config[OrganizationConfigKey.MembersPageEnabled]).toBe(true);
    });

    it("throws for invalid value", async () => {
      const org = await createOrganization("cfg-mpe-invalid");

      await expect(
        OrganizationConfigService.setConfig(
          org.id,
          OrganizationConfigKey.MembersPageEnabled,
          "yes",
        ),
      ).rejects.toThrow("Value must be 'true' or 'false'");
    });

    it("is isolated per organization", async () => {
      const org1 = await createOrganization("cfg-mpe-iso1");
      const org2 = await createOrganization("cfg-mpe-iso2");

      await OrganizationConfigService.setConfig(
        org1.id,
        OrganizationConfigKey.MembersPageEnabled,
        "false",
      );

      const config1 = await OrganizationConfigService.getConfig(org1.id, [
        OrganizationConfigKey.MembersPageEnabled,
      ]);
      const config2 = await OrganizationConfigService.getConfig(org2.id, [
        OrganizationConfigKey.MembersPageEnabled,
      ]);

      expect(config1[OrganizationConfigKey.MembersPageEnabled]).toBe(false);
      expect(config2[OrganizationConfigKey.MembersPageEnabled]).toBe(true);
    });
  });
});

describe("OrganizationConfigService - forms_enabled", () => {
  it("is off by default", async () => {
    const org = await createOrganization("cfg-forms-default");

    const config = await OrganizationConfigService.getConfig(org.id, [
      OrganizationConfigKey.FormsEnabled,
    ]);

    expect(config[OrganizationConfigKey.FormsEnabled]).toBe(false);
  });

  it("can be turned on and off again", async () => {
    const org = await createOrganization("cfg-forms-toggle");

    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.FormsEnabled,
      "true",
    );
    const on = await OrganizationConfigService.getConfig(org.id, [
      OrganizationConfigKey.FormsEnabled,
    ]);
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.FormsEnabled,
      "false",
    );
    const off = await OrganizationConfigService.getConfig(org.id, [
      OrganizationConfigKey.FormsEnabled,
    ]);

    expect(on[OrganizationConfigKey.FormsEnabled]).toBe(true);
    expect(off[OrganizationConfigKey.FormsEnabled]).toBe(false);
    const rows = await db
      .select()
      .from(organizationConfig)
      .where(eq(organizationConfig.organizationId, org.id));
    expect(rows).toHaveLength(1);
  });

  it("throws for an invalid value", async () => {
    const org = await createOrganization("cfg-forms-invalid");

    await expect(
      OrganizationConfigService.setConfig(
        org.id,
        OrganizationConfigKey.FormsEnabled,
        "on",
      ),
    ).rejects.toThrow("Value must be 'true' or 'false'");
  });

  it("is isolated per organization", async () => {
    const org1 = await createOrganization("cfg-forms-iso1");
    const org2 = await createOrganization("cfg-forms-iso2");

    await OrganizationConfigService.setConfig(
      org1.id,
      OrganizationConfigKey.FormsEnabled,
      "true",
    );

    const config2 = await OrganizationConfigService.getConfig(org2.id, [
      OrganizationConfigKey.FormsEnabled,
    ]);
    expect(config2[OrganizationConfigKey.FormsEnabled]).toBe(false);
  });
});

describe("OrganizationConfigService - organization theme", () => {
  const newThemeKeys = [
    OrganizationConfigKey.BackgroundColor,
    OrganizationConfigKey.TextColor,
    OrganizationConfigKey.DisplayFont,
    OrganizationConfigKey.HeadingFont,
    OrganizationConfigKey.BodyFont,
    OrganizationConfigKey.CornerStyle,
  ];

  it("returns today's defaults when no theme rows exist", async () => {
    const org = await createOrganization("cfg-theme-default");

    const config = await OrganizationConfigService.getConfig(
      org.id,
      newThemeKeys,
    );

    expect(config).toEqual({
      [OrganizationConfigKey.BackgroundColor]:
        DEFAULT_APP_THEME.backgroundColor,
      [OrganizationConfigKey.TextColor]: DEFAULT_APP_THEME.textColor,
      [OrganizationConfigKey.DisplayFont]: DEFAULT_APP_THEME.displayFont,
      [OrganizationConfigKey.HeadingFont]: DEFAULT_APP_THEME.headingFont,
      [OrganizationConfigKey.BodyFont]: DEFAULT_APP_THEME.bodyFont,
      [OrganizationConfigKey.CornerStyle]: DEFAULT_APP_THEME.cornerStyle,
    });
  });

  it("keeps raw theme config empty when an organization has no saved theme", async () => {
    const org = await createOrganization("cfg-theme-raw-default");

    await expect(
      OrganizationConfigService.getThemeConfig(org.id),
    ).resolves.toEqual({});
  });

  it("stores and retrieves every new theme value", async () => {
    const org = await createOrganization("cfg-theme-values");
    const values = {
      [OrganizationConfigKey.BackgroundColor]: "#FFFEF1",
      [OrganizationConfigKey.TextColor]: "#373444",
      [OrganizationConfigKey.DisplayFont]: "fredoka",
      [OrganizationConfigKey.HeadingFont]: "lexend",
      [OrganizationConfigKey.BodyFont]: "lexend",
      [OrganizationConfigKey.CornerStyle]: "pill",
    };

    await Promise.all(
      Object.entries(values).map(([key, value]) =>
        OrganizationConfigService.setConfig(
          org.id,
          key as OrganizationConfigKey,
          value,
        ),
      ),
    );

    await expect(
      OrganizationConfigService.getConfig(org.id, newThemeKeys),
    ).resolves.toEqual(values);
    await expect(
      OrganizationConfigService.getThemeConfig(org.id),
    ).resolves.toEqual(values);
  });

  it("updates a theme value instead of creating another row", async () => {
    const org = await createOrganization("cfg-theme-update");

    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.BackgroundColor,
      "#FFFFFF",
    );
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.BackgroundColor,
      "#FFFEF1",
    );

    const rows = await db
      .select()
      .from(organizationConfig)
      .where(eq(organizationConfig.organizationId, org.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe("#FFFEF1");
  });

  it.each([
    [OrganizationConfigKey.BackgroundColor, "cream", "valid hex code"],
    [OrganizationConfigKey.TextColor, "rgb(0,0,0)", "valid hex code"],
    [OrganizationConfigKey.DisplayFont, "comic-sans", "Font must be one of"],
    [OrganizationConfigKey.HeadingFont, "serif", "Font must be one of"],
    [OrganizationConfigKey.BodyFont, "arial", "Font must be one of"],
    [OrganizationConfigKey.CornerStyle, "extra-round", "must be one of"],
  ])("rejects an invalid %s value", async (key, value, message) => {
    const org = await createOrganization(`cfg-theme-invalid-${key}`);

    await expect(
      OrganizationConfigService.setConfig(org.id, key, value),
    ).rejects.toThrow(message);
  });

  it("does not leak saved theme values between organizations", async () => {
    const orgA = await createOrganization("cfg-theme-iso-a");
    const orgB = await createOrganization("cfg-theme-iso-b");

    await OrganizationConfigService.setConfig(
      orgA.id,
      OrganizationConfigKey.TextColor,
      "#373444",
    );

    await expect(
      OrganizationConfigService.getThemeConfig(orgB.id),
    ).resolves.toEqual({});
    const configB = await OrganizationConfigService.getConfig(orgB.id, [
      OrganizationConfigKey.TextColor,
    ]);
    expect(configB[OrganizationConfigKey.TextColor]).toBe(
      DEFAULT_APP_THEME.textColor,
    );
  });
});

describe.each([
  OrganizationConfigKey.MemberTypesEnabled,
  OrganizationConfigKey.AutoApproveSignups,
] as const)("OrganizationConfigService - %s", (key) => {
  it("defaults to false", async () => {
    const org = await createOrganization(`cfg-${key}-default`);

    const config = await OrganizationConfigService.getConfig(org.id, [key]);

    expect(config[key]).toBe(false);
  });

  it("turns on and off, keeping one row", async () => {
    const org = await createOrganization(`cfg-${key}-toggle`);

    await OrganizationConfigService.setConfig(org.id, key, "true");
    const on = await OrganizationConfigService.getConfig(org.id, [key]);
    await OrganizationConfigService.setConfig(org.id, key, "false");
    const off = await OrganizationConfigService.getConfig(org.id, [key]);

    expect(on[key]).toBe(true);
    expect(off[key]).toBe(false);
    const rows = await db
      .select()
      .from(organizationConfig)
      .where(eq(organizationConfig.organizationId, org.id));
    expect(rows).toHaveLength(1);
  });

  it("rejects values other than 'true' and 'false'", async () => {
    const org = await createOrganization(`cfg-${key}-invalid`);

    await expect(
      OrganizationConfigService.setConfig(org.id, key, "on"),
    ).rejects.toThrow("Value must be 'true' or 'false'");
  });

  it("is scoped to the organization", async () => {
    const org1 = await createOrganization(`cfg-${key}-org1`);
    const org2 = await createOrganization(`cfg-${key}-org2`);

    await OrganizationConfigService.setConfig(org1.id, key, "true");

    const config2 = await OrganizationConfigService.getConfig(org2.id, [key]);
    expect(config2[key]).toBe(false);
  });
});

