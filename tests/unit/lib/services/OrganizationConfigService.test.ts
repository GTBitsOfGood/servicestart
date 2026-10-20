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

describe("OrganizationConfigService - keys without handlers", () => {
  // These keys exist for #302, which adds their get/set.
  it("rejects setting a key that has no handler yet", async () => {
    const org = await createOrganization("cfg-unhandled-set");

    await expect(
      OrganizationConfigService.setConfig(
        org.id,
        OrganizationConfigKey.MemberTypesEnabled,
        "true",
      ),
    ).rejects.toThrow("Invalid key");
  });

  it("leaves keys without handlers out of getConfig", async () => {
    const org = await createOrganization("cfg-unhandled-get");

    const config = await OrganizationConfigService.getConfig(org.id, [
      OrganizationConfigKey.MemberTypesEnabled,
      OrganizationConfigKey.FormsEnabled,
    ]);

    expect(config).toEqual({ [OrganizationConfigKey.FormsEnabled]: false });
  });

  it("ignores keys that aren't config keys", async () => {
    const org = await createOrganization("cfg-unhandled-proto");

    const config = await OrganizationConfigService.getConfig(org.id, [
      "constructor" as OrganizationConfigKey,
    ]);

    expect(config).toEqual({});
  });
});

describe("OrganizationConfigService - AdminDashboardLayout", () => {
  it("returns default admin layout when no config exists", async () => {
    const org = await createOrganization("cfg-adl-default");
    const layout = await OrganizationConfigService.getAdminDashboardLayout(
      org.id,
    );
    expect(layout).toEqual(DEFAULT_ADMIN_LAYOUT);
  });

  it("stores and retrieves a valid layout", async () => {
    const org = await createOrganization("cfg-adl-store");
    const testLayout = {
      layout: "horizontal" as const,
      widgets: [
        { id: "events" as const, size: "tall" as const },
        { id: "notifications" as const, size: "small" as const },
        { id: "member_requests" as const, size: "small" as const },
      ],
    };

    await OrganizationConfigService.setAdminDashboardLayout(
      org.id,
      JSON.stringify(testLayout),
    );

    const retrieved = await OrganizationConfigService.getAdminDashboardLayout(
      org.id,
    );
    expect(retrieved).toEqual(testLayout);
  });

  it("updates existing layout (upsert)", async () => {
    const org = await createOrganization("cfg-adl-upsert");
    const layout1 = {
      layout: "horizontal",
      widgets: [{ id: "events", size: "tall" }],
    };
    const layout2 = {
      layout: "horizontal",
      widgets: [
        { id: "notifications", size: "tall" },
        { id: "newsletter", size: "tall" },
      ],
    };

    await OrganizationConfigService.setAdminDashboardLayout(
      org.id,
      JSON.stringify(layout1),
    );
    await OrganizationConfigService.setAdminDashboardLayout(
      org.id,
      JSON.stringify(layout2),
    );

    const retrieved = await OrganizationConfigService.getAdminDashboardLayout(
      org.id,
    );
    expect(retrieved).toEqual(layout2);
  });

  it("rejects invalid JSON", async () => {
    const org = await createOrganization("cfg-adl-bad-json");
    await expect(
      OrganizationConfigService.setAdminDashboardLayout(
        org.id,
        "not valid json",
      ),
    ).rejects.toThrow("Invalid JSON for admin dashboard layout");
  });

  it("rejects invalid layout structure", async () => {
    const org = await createOrganization("cfg-adl-bad-layout");
    await expect(
      OrganizationConfigService.setAdminDashboardLayout(
        org.id,
        JSON.stringify({ layout: "diagonal", widgets: [] }),
      ),
    ).rejects.toThrow("Invalid admin dashboard layout");
  });

  it("returns default when stored value is corrupted", async () => {
    const org = await createOrganization("cfg-adl-corrupt");
    await db.insert(organizationConfig).values({
      id: randomUUID(),
      organizationId: org.id,
      key: OrganizationConfigKey.AdminDashboardLayout,
      value: "corrupted-data",
    });

    const layout = await OrganizationConfigService.getAdminDashboardLayout(
      org.id,
    );
    expect(layout).toEqual(DEFAULT_ADMIN_LAYOUT);
  });
});

describe("OrganizationConfigService - DashboardLayout", () => {
  it("returns default member layout when no config exists", async () => {
    const org = await createOrganization("cfg-dl-default");
    const layout = await OrganizationConfigService.getDashboardLayout(org.id);
    expect(layout).toEqual(DEFAULT_MEMBER_LAYOUT);
  });

  it("stores and retrieves a valid layout", async () => {
    const org = await createOrganization("cfg-dl-store");
    const testLayout = {
      layout: "horizontal" as const,
      widgets: [
        { id: "events" as const, size: "tall" as const },
        { id: "newsletter" as const, size: "tall" as const },
      ],
    };

    await OrganizationConfigService.setDashboardLayout(
      org.id,
      JSON.stringify(testLayout),
    );

    const retrieved = await OrganizationConfigService.getDashboardLayout(
      org.id,
    );
    expect(retrieved).toEqual(testLayout);
  });

  it("rejects invalid JSON", async () => {
    const org = await createOrganization("cfg-dl-bad-json");
    await expect(
      OrganizationConfigService.setDashboardLayout(org.id, "not valid json"),
    ).rejects.toThrow("Invalid JSON for dashboard layout");
  });

  it("rejects invalid layout structure", async () => {
    const org = await createOrganization("cfg-dl-bad-layout");
    await expect(
      OrganizationConfigService.setDashboardLayout(
        org.id,
        JSON.stringify({ widgets: [{ id: "unknown", size: "huge" }] }),
      ),
    ).rejects.toThrow("Invalid dashboard layout");
  });

  it("is isolated per organization", async () => {
    const org1 = await createOrganization("cfg-dl-iso1");
    const org2 = await createOrganization("cfg-dl-iso2");

    const layout1 = {
      layout: "horizontal",
      widgets: [{ id: "events", size: "tall" }],
    };

    await OrganizationConfigService.setDashboardLayout(
      org1.id,
      JSON.stringify(layout1),
    );

    const retrieved1 = await OrganizationConfigService.getDashboardLayout(
      org1.id,
    );
    const retrieved2 = await OrganizationConfigService.getDashboardLayout(
      org2.id,
    );

    expect(retrieved1).toEqual(layout1);
    expect(retrieved2).toEqual(DEFAULT_MEMBER_LAYOUT);
  });
});

describe("OrganizationConfigService - branding defaults", () => {
  it("returns documented defaults when no branding rows exist", async () => {
    const org = await createOrganization("cfg-brand-default");

    const config = await OrganizationConfigService.getConfig(org.id, [
      OrganizationConfigKey.PrimaryColor,
      OrganizationConfigKey.SecondaryColor,
    ]);

    expect(config[OrganizationConfigKey.PrimaryColor]).toBe(
      DEFAULT_BRANDING[OrganizationConfigKey.PrimaryColor],
    );
    expect(config[OrganizationConfigKey.SecondaryColor]).toBe(
      DEFAULT_BRANDING[OrganizationConfigKey.SecondaryColor],
    );
  });

  it("returns a configured primary color with the default secondary", async () => {
    const org = await createOrganization("cfg-brand-partial");

    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.PrimaryColor,
      "#000000",
    );

    const config = await OrganizationConfigService.getConfig(org.id, [
      OrganizationConfigKey.PrimaryColor,
      OrganizationConfigKey.SecondaryColor,
    ]);

    expect(config[OrganizationConfigKey.PrimaryColor]).toBe("#000000");
    expect(config[OrganizationConfigKey.SecondaryColor]).toBe(
      DEFAULT_BRANDING[OrganizationConfigKey.SecondaryColor],
    );
  });

  it("does not override a fully configured organization", async () => {
    const org = await createOrganization("cfg-brand-full");

    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.PrimaryColor,
      "#123456",
    );
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.SecondaryColor,
      "#654321",
    );

    const config = await OrganizationConfigService.getConfig(org.id, [
      OrganizationConfigKey.PrimaryColor,
      OrganizationConfigKey.SecondaryColor,
    ]);

    expect(config[OrganizationConfigKey.PrimaryColor]).toBe("#123456");
    expect(config[OrganizationConfigKey.SecondaryColor]).toBe("#654321");
  });

  it("does not leak branding from one organization to another", async () => {
    const orgA = await createOrganization("cfg-brand-iso-a");
    const orgB = await createOrganization("cfg-brand-iso-b");

    await OrganizationConfigService.setConfig(
      orgA.id,
      OrganizationConfigKey.PrimaryColor,
      "#aaaaaa",
    );
    await OrganizationConfigService.setConfig(
      orgA.id,
      OrganizationConfigKey.SecondaryColor,
      "#bbbbbb",
    );

    const configB = await OrganizationConfigService.getConfig(orgB.id, [
      OrganizationConfigKey.PrimaryColor,
      OrganizationConfigKey.SecondaryColor,
    ]);

    expect(configB[OrganizationConfigKey.PrimaryColor]).toBe(
      DEFAULT_BRANDING[OrganizationConfigKey.PrimaryColor],
    );
    expect(configB[OrganizationConfigKey.SecondaryColor]).toBe(
      DEFAULT_BRANDING[OrganizationConfigKey.SecondaryColor],
    );
  });
});
